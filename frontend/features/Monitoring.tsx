import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import Svg, {
  Path,
  Line,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
  Text as SvgText,
  Rect,
} from "react-native-svg";
import {
  Activity,
  Zap,
  Gauge,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Settings,
  RefreshCw,
  Play,
  Pause,
  Sliders,
  ChevronRight,
  Sun,
  Shield,
  Layers,
  ArrowRight,
  Info,
  DollarSign,
  Calendar,
  Radio,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import {
  GlassPanel,
  Title,
  Copy,
  Label,
  PremiumButton,
  colors,
  s,
} from "../components/ui";
import { theme } from "../theme";
import {
  fetchMonitoringSummary,
  fetchLiveEnergy,
  fetchEnergyHistory,
  fetchPrediction,
  saveUserObjectives,
  markAlertRead,
  type LiveEnergyData,
  type EnergyHistoryResponse,
  type EnergyDataPoint,
  type ConsumptionPredictionResponse,
  type UserObjectives,
  type SmartAlert,
  type HistoryRange,
} from "../services/iotApi";

const TIME_RANGES: { key: HistoryRange; label: string }[] = [
  { key: "second", label: "Seconde" },
  { key: "minute", label: "Minute" },
  { key: "hour", label: "Heure" },
  { key: "day", label: "Jour" },
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "year", label: "Année" },
];

export default function Monitoring() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 1050;

  // ───────────────────────────────────────────────────────────────────────────
  // State
  // ───────────────────────────────────────────────────────────────────────────
  const [live, setLive] = useState<LiveEnergyData>({
    status: "idle",
    connected: false,
    badge: "Simulation Mokxi",
    device_id: "SOLAR-MOKXI-001",
    voltage_v: 5.65,
    current_a: 0.157,
    current_ma: 157.0,
    power_w: 0.887,
    cumulative_energy_wh: 0.03,
    cumulative_energy_kwh: 0.00003,
    timestamp: new Date().toISOString(),
    timestamp_tunis: "2026-11-22 01:56:53",
    age_seconds: 5,
  });

  const [history, setHistory] = useState<EnergyHistoryResponse | null>(null);
  const [selectedRange, setSelectedRange] = useState<HistoryRange>("minute");
  const [prediction, setPrediction] = useState<ConsumptionPredictionResponse | null>(null);
  const [objectives, setObjectives] = useState<UserObjectives>({
    monthly_consumption_target_kwh: 1200.0,
    monthly_budget_tnd: 350.0,
    monthly_solar_target_kwh: 380.0,
    reduction_target_pct: 15.0,
  });
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [isEditingObjectives, setIsEditingObjectives] = useState<boolean>(false);

  // Objectives form fields
  const [editTargetKwh, setEditTargetKwh] = useState("1200");
  const [editBudgetTnd, setEditBudgetTnd] = useState("350");
  const [editSolarKwh, setEditSolarKwh] = useState("380");
  const [editReductionPct, setEditReductionPct] = useState("15");

  // Interactive Scenario Simulator (Mandatory Test Case Playground)
  const [simTarget, setSimTarget] = useState<number>(1200);
  const [simCurrent, setSimCurrent] = useState<number>(900);
  const [simDay, setSimDay] = useState<number>(15);
  const [simTotalDays, setSimTotalDays] = useState<number>(30);
  const [simResult, setSimResult] = useState<ConsumptionPredictionResponse | null>(null);

  // Active Curves toggles
  const [showVoltage, setShowVoltage] = useState<boolean>(true);
  const [showCurrent, setShowCurrent] = useState<boolean>(true);
  const [showPower, setShowPower] = useState<boolean>(true);
  const [showCumulative, setShowCumulative] = useState<boolean>(true);
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // Initial Data Load
  // ───────────────────────────────────────────────────────────────────────────
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const summary = await fetchMonitoringSummary();
      if (summary.live) setLive(summary.live);
      if (summary.objectives) {
        setObjectives(summary.objectives);
        setEditTargetKwh(String(summary.objectives.monthly_consumption_target_kwh));
        setEditBudgetTnd(String(summary.objectives.monthly_budget_tnd));
        setEditSolarKwh(String(summary.objectives.monthly_solar_target_kwh));
        setEditReductionPct(String(summary.objectives.reduction_target_pct));
      }
      if (summary.prediction) setPrediction(summary.prediction);
      if (summary.recent_alerts) setAlerts(summary.recent_alerts);

      const hist = await fetchEnergyHistory(selectedRange, 40);
      setHistory(hist);
    } catch (e) {
      console.warn("Échec chargement initial IoT summary:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedRange]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ───────────────────────────────────────────────────────────────────────────
  // Live Streaming Polling (1 second real-time refresh)
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(async () => {
      try {
        if (demoMode) {
          // Synthetic high-resolution daylight curve
          const t = Date.now() / 1000;
          const v = Math.min(5.985, Math.max(0, 5.75 + 0.22 * Math.sin(t / 8)));
          const iMa = (v / 36.0) * 1000.0;
          const pW = (v * iMa) / 1000.0;
          setLive((prev) => ({
            ...prev,
            status: "active",
            connected: true,
            badge: "Mode démonstration",
            voltage_v: Number(v.toFixed(3)),
            current_ma: Number(iMa.toFixed(1)),
            current_a: Number((iMa / 1000).toFixed(4)),
            power_w: Number(pW.toFixed(4)),
            cumulative_energy_wh: Number((prev.cumulative_energy_wh + pW * (1.0 / 3600)).toFixed(4)),
            cumulative_energy_kwh: Number(((prev.cumulative_energy_wh + pW * (1.0 / 3600)) / 1000).toFixed(6)),
            age_seconds: 1,
            timestamp_tunis: new Date().toLocaleTimeString("fr-TN"),
          }));
        } else {
          const fresh = await fetchLiveEnergy();
          setLive(fresh);
        }
      } catch (err) {
        // Keep previous reading on momentary connection glitch
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming, demoMode]);

  // ───────────────────────────────────────────────────────────────────────────
  // Update History on Range Change
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchEnergyHistory(selectedRange, 40)
      .then(setHistory)
      .catch((e) => console.warn("Erreur fetch history:", e));
  }, [selectedRange]);

  // ───────────────────────────────────────────────────────────────────────────
  // Deterministic Scenario Calculation
  // ───────────────────────────────────────────────────────────────────────────
  const runScenarioCalculation = useCallback(async () => {
    try {
      const res = await fetchPrediction({
        target_kwh: simTarget,
        current_kwh: simCurrent,
        current_day: simDay,
        total_days: simTotalDays,
      });
      setSimResult(res);
    } catch (e) {
      console.warn("Erreur calcul scénario:", e);
    }
  }, [simTarget, simCurrent, simDay, simTotalDays]);

  useEffect(() => {
    runScenarioCalculation();
  }, [runScenarioCalculation]);

  // Load Mandatory Test Case: 1200 kWh target, 900 kWh used by Day 15 of 30-day month
  const loadMandatoryTestCase = () => {
    setSimTarget(1200);
    setSimCurrent(900);
    setSimDay(15);
    setSimTotalDays(30);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Save Objectives
  // ───────────────────────────────────────────────────────────────────────────
  const handleSaveObjectives = async () => {
    try {
      const updated = await saveUserObjectives({
        monthly_consumption_target_kwh: parseFloat(editTargetKwh) || 1200,
        monthly_budget_tnd: parseFloat(editBudgetTnd) || 350,
        monthly_solar_target_kwh: parseFloat(editSolarKwh) || 380,
        reduction_target_pct: parseFloat(editReductionPct) || 15,
      });
      setObjectives(updated);
      setIsEditingObjectives(false);
      // Refresh prediction
      const freshPred = await fetchPrediction({
        target_kwh: updated.monthly_consumption_target_kwh,
      });
      setPrediction(freshPred);
    } catch (e) {
      alert("Erreur lors de la sauvegarde des objectifs");
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Mark Alert Read
  // ───────────────────────────────────────────────────────────────────────────
  const handleMarkAlertRead = async (id: number) => {
    try {
      await markAlertRead(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
      );
    } catch (e) {
      console.warn("Erreur lecture alerte:", e);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Chart Geometry & Points
  // ───────────────────────────────────────────────────────────────────────────
  const chartData: EnergyDataPoint[] = useMemo(() => {
    if (history && history.data && history.data.length > 0) {
      return history.data;
    }
    // Fallback baseline points for preview
    return [
      { time: "08:00", label: "08:00", voltage_v: 5.1, current_a: 0.14, current_ma: 140, power_w: 0.71, cumulative_wh: 0.01 },
      { time: "09:00", label: "09:00", voltage_v: 5.4, current_a: 0.15, current_ma: 150, power_w: 0.81, cumulative_wh: 0.02 },
      { time: "10:00", label: "10:00", voltage_v: 5.65, current_a: 0.157, current_ma: 157, power_w: 0.887, cumulative_wh: 0.03 },
      { time: "11:00", label: "11:00", voltage_v: 5.85, current_a: 0.162, current_ma: 162, power_w: 0.948, cumulative_wh: 0.045 },
      { time: "12:00", label: "12:00", voltage_v: 5.98, current_a: 0.166, current_ma: 166, power_w: 0.993, cumulative_wh: 0.06 },
    ];
  }, [history]);

  const svgWidth = 620;
  const svgHeight = 220;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;
  const innerW = svgWidth - padLeft - padRight;
  const innerH = svgHeight - padTop - padBottom;

  // Max values for normalized dual scale
  const maxV = 6.2;
  const maxI = 180;
  const maxP = 1.1;
  const maxWh = Math.max(...chartData.map((d) => d.cumulative_wh), 0.1) * 1.2;

  const pointsWh: [number, number][] = chartData.map((d, i) => [
    padLeft + (i * innerW) / Math.max(1, chartData.length - 1),
    padTop + innerH - (Math.min(d.cumulative_wh, maxWh) / maxWh) * innerH,
  ]);

  const pointsV: [number, number][] = chartData.map((d, i) => [
    padLeft + (i * innerW) / Math.max(1, chartData.length - 1),
    padTop + innerH - (Math.min(d.voltage_v, maxV) / maxV) * innerH,
  ]);
  const pointsI: [number, number][] = chartData.map((d, i) => [
    padLeft + (i * innerW) / Math.max(1, chartData.length - 1),
    padTop + innerH - (Math.min(d.current_ma, maxI) / maxI) * innerH,
  ]);
  const pointsP: [number, number][] = chartData.map((d, i) => [
    padLeft + (i * innerW) / Math.max(1, chartData.length - 1),
    padTop + innerH - (Math.min(d.power_w, maxP) / maxP) * innerH,
  ]);

  const buildPath = (pts: [number, number][]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${(p[0] ?? 0).toFixed(1)},${(p[1] ?? 0).toFixed(1)}`).join(" ");

  const pathV = buildPath(pointsV);
  const pathI = buildPath(pointsI);
  const pathP = buildPath(pointsP);
  const pathWh = buildPath(pointsWh);

  // Status pulse color
  const statusColor =
    live.age_seconds < 20
      ? "#10B981" // Vert vif
      : live.age_seconds < 120
      ? "#F59E0B" // Orange
      : "#94A3B8"; // Déconnecté

  const effectivePrediction = simResult || prediction;

  return (
    <ResponsiveLayout>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 60,
          gap: 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* 1. Header & Live Status Bar                                         */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <View style={{ gap: 6, maxWidth: 650 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: statusColor,
                }}
              />
              <Label>IOT LIVE ENERGY & TELEMETRY</Label>
            </View>
            <Title>Smart Energy Monitoring</Title>
            <Copy>« Suivez votre énergie en temps réel »</Copy>
          </View>

          {/* Quick Actions & Status Badge */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: "#FFF9ED",
                borderWidth: 1.5,
                borderColor: "#FFE29A",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
              }}
            >
              <Radio size={16} color="#D97706" />
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#B45309" }}>
                {demoMode ? "Mode Démonstration" : live.badge || "Simulation Mokxi"}
              </Text>
            </View>

            {/* Play/Pause Streaming */}
            <Pressable
              onPress={() => setIsStreaming(!isStreaming)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: isStreaming ? "#FEF3C7" : "#F1F5F9",
                borderWidth: 1,
                borderColor: isStreaming ? "#F59E0B" : "#CBD5E1",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
              }}
            >
              {isStreaming ? (
                <>
                  <Pause size={14} color="#D97706" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#D97706" }}>Live Actif</Text>
                </>
              ) : (
                <>
                  <Play size={14} color="#64748B" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#64748B" }}>En pause</Text>
                </>
              )}
            </Pressable>

            {/* Demo Mode Toggle */}
            <Pressable
              onPress={() => setDemoMode(!demoMode)}
              style={{
                backgroundColor: demoMode ? "#E0F2FE" : "#F8FAFC",
                borderWidth: 1,
                borderColor: demoMode ? "#0284C7" : "#E2E8F0",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: demoMode ? "#0369A1" : "#64748B",
                }}
              >
                {demoMode ? "Mode Démo ON" : "Activer Démo"}
              </Text>
            </Pressable>

            {/* Manual Refresh */}
            <Pressable
              onPress={loadInitialData}
              style={{
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: theme.colors.line,
                padding: 8,
                borderRadius: 20,
              }}
            >
              <RefreshCw size={16} color="#64748B" />
            </Pressable>

            {/* Objectives Settings */}
            <Pressable
              onPress={() => setIsEditingObjectives(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "#151515",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
              }}
            >
              <Settings size={14} color="#FFFFFF" />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF" }}>Objectifs</Text>
            </Pressable>
          </View>
        </View>

        {/* Telemetry Hardware Banner */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: theme.colors.line,
            borderRadius: 16,
            padding: 14,
            paddingHorizontal: 18,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: "#FEF3C7",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Activity size={18} color="#D97706" />
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: "800", color: colors.midnight }}>
                Équipement : {live.device_id || "SOLAR-MOKXI-001"} (ESP32 DevKit V1)
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                GPIO 34 ADC · Diviseur 10V (10k/20k) · Résistance de charge : 36 Ω · Backend port 8001/8002
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>Dernière mesure :</Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.midnight }}>
                {live.timestamp_tunis || "En attente"} (
                {live.age_seconds < 60
                  ? `il y a ${Math.round(live.age_seconds)}s`
                  : `il y a ${Math.round(live.age_seconds / 60)} min`}
                )
              </Text>
            </View>
          </View>
        </View>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* 2. Key Metrics Bar (Instantaneous & Cumulative)                     */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          {/* Tension DC */}
          <View
            style={{
              flex: 1,
              minWidth: 155,
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: "#FDE68A",
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#B45309", letterSpacing: 1 }}>
                TENSION DC
              </Text>
              <Zap size={16} color="#F59E0B" />
            </View>
            <Text style={{ fontSize: 26, fontWeight: "900", color: colors.midnight }}>
              {live.voltage_v?.toFixed(2)}{" "}
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.muted }}>V</Text>
            </Text>
            <Text style={{ fontSize: 11, color: "#64748B" }}>Plage 0 - 6.0V (Seuil ADC 3.3V)</Text>
          </View>

          {/* Courant DC */}
          <View
            style={{
              flex: 1,
              minWidth: 155,
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: "#BAE6FD",
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#0369A1", letterSpacing: 1 }}>
                COURANT DC
              </Text>
              <Activity size={16} color="#0284C7" />
            </View>
            <Text style={{ fontSize: 26, fontWeight: "900", color: colors.midnight }}>
              {live.current_ma?.toFixed(1)}{" "}
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.muted }}>mA</Text>
            </Text>
            <Text style={{ fontSize: 11, color: "#64748B" }}>
              {(live.current_a || 0).toFixed(4)} A (I = V / 36Ω)
            </Text>
          </View>

          {/* Puissance Solaire */}
          <View
            style={{
              flex: 1,
              minWidth: 155,
              backgroundColor: "#FFFBEB",
              borderRadius: 20,
              padding: 16,
              borderWidth: 1.5,
              borderColor: "#F59E0B",
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#B45309", letterSpacing: 1 }}>
                PUISSANCE PV
              </Text>
              <Sun size={16} color="#D97706" />
            </View>
            <Text style={{ fontSize: 26, fontWeight: "900", color: "#B45309" }}>
              {live.power_w?.toFixed(3)}{" "}
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#D97706" }}>W</Text>
            </Text>
            <Text style={{ fontSize: 11, color: "#92400E" }}>Micro-panneau Mokxi (Crête ~1W)</Text>
          </View>

          {/* Énergie Cumulée */}
          <View
            style={{
              flex: 1,
              minWidth: 155,
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: "#A7F3D0",
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#047857", letterSpacing: 1 }}>
                ÉNERGIE CUMULÉE
              </Text>
              <TrendingUp size={16} color="#10B981" />
            </View>
            <Text style={{ fontSize: 26, fontWeight: "900", color: colors.midnight }}>
              {live.cumulative_energy_wh?.toFixed(3)}{" "}
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.muted }}>Wh</Text>
            </Text>
            <Text style={{ fontSize: 11, color: "#64748B" }}>Intégration trapézoïdale ∫ P dt</Text>
          </View>

          {/* Consommation Foyer (Distinct from 1W panel!) */}
          <View
            style={{
              flex: 1,
              minWidth: 175,
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.colors.line,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.midnight, letterSpacing: 1 }}>
                CONSO. FOYER
              </Text>
              <Gauge size={16} color="#6366F1" />
            </View>
            <Text style={{ fontSize: 26, fontWeight: "900", color: colors.midnight }}>
              {effectivePrediction ? effectivePrediction.current_consumption_kwh.toFixed(0) : "900"}{" "}
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.muted }}>kWh</Text>
            </Text>
            <Text style={{ fontSize: 11, color: "#64748B" }}>
              Réseau STEG (Maison 3-4 pièces)
            </Text>
          </View>
        </View>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* 3. Multi-Curve Real-Time SVG Chart                                 */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            padding: 22,
            borderWidth: 1,
            borderColor: theme.colors.line,
            gap: 16,
          }}
        >
          {/* Chart Header & Controls */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.midnight }}>
                Courbes Multi-Grandeurs en Temps Réel
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Tension, courant, puissance et énergie cumulée recalculée
              </Text>
            </View>

            {/* Granularity Selector */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: "#F8FAFC",
                padding: 3,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#E2E8F0",
              }}
            >
              {TIME_RANGES.map((r) => {
                const active = selectedRange === r.key;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setSelectedRange(r.key)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 10,
                      backgroundColor: active ? "#FFFFFF" : "transparent",
                      shadowColor: active ? "#000" : "transparent",
                      shadowOpacity: active ? 0.06 : 0,
                      shadowRadius: 4,
                      elevation: active ? 1 : 0,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: active ? "800" : "600",
                        color: active ? "#B45309" : "#64748B",
                      }}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Active Curves Toggle Pills */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {/* Voltage */}
            <Pressable
              onPress={() => setShowVoltage(!showVoltage)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: "#FF9500",
                backgroundColor: showVoltage ? "#FFFBEB" : "#F8FAFC",
                opacity: showVoltage ? 1 : 0.5,
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#FF9500" }} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#B45309" }}>Tension (V)</Text>
            </Pressable>

            {/* Current */}
            <Pressable
              onPress={() => setShowCurrent(!showCurrent)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: "#0284C7",
                backgroundColor: showCurrent ? "#F0F9FF" : "#F8FAFC",
                opacity: showCurrent ? 1 : 0.5,
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#0284C7" }} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#0369A1" }}>Courant (mA)</Text>
            </Pressable>

            {/* Power */}
            <Pressable
              onPress={() => setShowPower(!showPower)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: "#D97706",
                backgroundColor: showPower ? "#FEF3C7" : "#F8FAFC",
                opacity: showPower ? 1 : 0.5,
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#D97706" }} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#92400E" }}>Puissance (W)</Text>
            </Pressable>

            {/* Cumulative Energy */}
            <Pressable
              onPress={() => setShowCumulative(!showCumulative)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: "#10B981",
                backgroundColor: showCumulative ? "#ECFDF5" : "#F8FAFC",
                opacity: showCumulative ? 1 : 0.5,
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#10B981" }} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#065F46" }}>Énergie (Wh)</Text>
            </Pressable>
          </View>

          {/* SVG Multi-curve Chart */}
          <View style={{ alignItems: "center", width: "100%" }}>
            <Svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height={230}>
              <Defs>
                <SvgLinearGradient id="powerFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#F59E0B" stopOpacity="0.3" />
                  <Stop offset="1" stopColor="#F59E0B" stopOpacity="0.0" />
                </SvgLinearGradient>
              </Defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                const y = padTop + innerH * pct;
                return (
                  <Line
                    key={idx}
                    x1={padLeft}
                    y1={y}
                    x2={svgWidth - padRight}
                    y2={y}
                    stroke="#F1F5F9"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Bottom X-Axis Axis Line */}
              <Line
                x1={padLeft}
                y1={padTop + innerH}
                x2={svgWidth - padRight}
                y2={padTop + innerH}
                stroke="#E2E8F0"
                strokeWidth={1.5}
              />

              {/* Area fill for power */}
              {showPower && pointsP.length > 1 && pointsP[0] && pointsP[pointsP.length - 1] && (
                <Path
                  d={`${pathP} L${(pointsP[pointsP.length - 1]?.[0] ?? 0).toFixed(1)},${padTop + innerH} L${(pointsP[0]?.[0] ?? 0).toFixed(1)},${padTop + innerH} Z`}
                  fill="url(#powerFill)"
                />
              )}

              {/* Curves */}
              {showVoltage && (
                <Path d={pathV} fill="none" stroke="#FF9500" strokeWidth={2.4} strokeLinecap="round" />
              )}
              {showCurrent && (
                <Path d={pathI} fill="none" stroke="#0284C7" strokeWidth={2.2} strokeLinecap="round" />
              )}
              {showPower && (
                <Path d={pathP} fill="none" stroke="#D97706" strokeWidth={2.8} strokeLinecap="round" />
              )}
              {showCumulative && (
                <Path
                  d={pathWh}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                />
              )}

              {/* Data points for Power */}
              {showPower &&
                pointsP.map((pt, i) => (
                  <Circle
                    key={i}
                    cx={pt[0]}
                    cy={pt[1]}
                    r={selectedPointIdx === i ? 6 : 3.5}
                    fill={selectedPointIdx === i ? "#D97706" : "#FFFFFF"}
                    stroke="#D97706"
                    strokeWidth={2}
                    {...(Platform.OS === "web"
                      ? ({ onClick: () => setSelectedPointIdx(i), cursor: "pointer" } as any)
                      : { onPress: () => setSelectedPointIdx(i) })}
                  />
                ))}

              {/* X Labels */}
              {chartData.map((d, i) => {
                if (i % Math.ceil(chartData.length / 6) !== 0 && i !== chartData.length - 1) return null;
                const x = padLeft + (i * innerW) / Math.max(1, chartData.length - 1);
                return (
                  <SvgText
                    key={i}
                    x={x}
                    y={svgHeight - 10}
                    fontSize="10"
                    fill="#94A3B8"
                    textAnchor="middle"
                    fontWeight="600"
                  >
                    {d.label || d.time.slice(11, 16)}
                  </SvgText>
                );
              })}
            </Svg>
          </View>

          {/* Selected Point Tooltip Bar */}
          {selectedPointIdx !== null && chartData[selectedPointIdx] && (
            <View
              style={{
                backgroundColor: "#FFFBEB",
                borderWidth: 1,
                borderColor: "#FDE68A",
                borderRadius: 14,
                padding: 12,
                flexDirection: "row",
                justifyContent: "space-around",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#B45309" }}>
                Mesure à {chartData[selectedPointIdx].time.slice(11, 19)} :
              </Text>
              <Text style={{ fontSize: 12, color: "#B45309" }}>
                U: <Text style={{ fontWeight: "800" }}>{chartData[selectedPointIdx].voltage_v.toFixed(2)}V</Text>
              </Text>
              <Text style={{ fontSize: 12, color: "#0369A1" }}>
                I: <Text style={{ fontWeight: "800" }}>{chartData[selectedPointIdx].current_ma.toFixed(1)}mA</Text>
              </Text>
              <Text style={{ fontSize: 12, color: "#92400E" }}>
                P: <Text style={{ fontWeight: "800" }}>{chartData[selectedPointIdx].power_w.toFixed(3)}W</Text>
              </Text>
              <Text style={{ fontSize: 12, color: "#065F46" }}>
                E: <Text style={{ fontWeight: "800" }}>{chartData[selectedPointIdx].cumulative_wh.toFixed(4)}Wh</Text>
              </Text>
            </View>
          )}

          {/* Statistics Summary */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              borderTopWidth: 1,
              borderColor: "#F1F5F9",
              paddingTop: 14,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <View>
              <Text style={{ fontSize: 11, color: colors.muted }}>Énergie totale période</Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: colors.midnight }}>
                {history?.total_energy_wh?.toFixed(3) || "0.030"} Wh
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: colors.muted }}>Puissance moyenne</Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: colors.midnight }}>
                {history?.avg_power_w?.toFixed(3) || "0.850"} W
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: colors.muted }}>Puissance crête (Peak)</Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#D97706" }}>
                {history?.peak_power_w?.toFixed(3) || "0.995"} W
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: colors.muted }}>Points de mesure</Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: colors.midnight }}>
                {history?.count || chartData.length} échantillons
              </Text>
            </View>
          </View>
        </View>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* 4. Smart Prediction Engine & Budget Alerts (Deterministic)           */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: theme.colors.line,
            gap: 20,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Gauge size={18} color="#D97706" />
                <Label>MOTEUR DÉTERMINISTE DE PRÉDICTION</Label>
              </View>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.midnight }}>
                Projection de Consommation & Alerte de Dépassement
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Calcul direct et vérifiable : E_fin_de_mois = (Conso_actuelle / Jour) × Nb_jours
              </Text>
            </View>

            {/* Test Case Quick Button */}
            <Pressable
              onPress={loadMandatoryTestCase}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "#FEF3C7",
                borderWidth: 1,
                borderColor: "#F59E0B",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 14,
              }}
            >
              <Sparkles size={14} color="#B45309" />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#B45309" }}>
                Cas Test Référent (1200 / 900 kWh au J15)
              </Text>
            </Pressable>
          </View>

          {/* Proactive Alert Banner (Orange) */}
          {effectivePrediction && effectivePrediction.is_overrun_risk && (
            <View
              style={{
                backgroundColor: "#FFFBEB",
                borderRadius: 18,
                padding: 16,
                borderWidth: 1.5,
                borderColor: "#F59E0B",
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <AlertTriangle size={22} color="#D97706" />
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#B45309" }}>
                  {effectivePrediction.alert_title}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: "#92400E", lineHeight: 20 }}>
                {effectivePrediction.alert_message}
              </Text>
            </View>
          )}

          {/* Visual Budget Progress Bar */}
          {effectivePrediction && (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                <View>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Consommation au Jour {effectivePrediction.current_day} :</Text>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: colors.midnight }}>
                    {effectivePrediction.current_consumption_kwh.toFixed(0)} kWh{" "}
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.muted }}>
                      / {effectivePrediction.monthly_target_kwh.toFixed(0)} kWh
                    </Text>
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Taux consommé :</Text>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "900",
                      color: effectivePrediction.consumed_pct > 70 ? "#D97706" : "#10B981",
                    }}
                  >
                    {effectivePrediction.consumed_pct.toFixed(1)} %
                  </Text>
                </View>
              </View>

              {/* Multi-segment Progress Bar */}
              <View
                style={{
                  height: 16,
                  backgroundColor: "#F1F5F9",
                  borderRadius: 8,
                  overflow: "hidden",
                  flexDirection: "row",
                }}
              >
                {/* Consumed part */}
                <View
                  style={{
                    width: `${Math.min(100, effectivePrediction.consumed_pct)}%`,
                    backgroundColor: effectivePrediction.is_overrun_risk ? "#F59E0B" : "#10B981",
                  }}
                />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11, color: colors.muted }}>Jour 1</Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#D97706" }}>
                  Jour {effectivePrediction.current_day} ({effectivePrediction.remaining_days} jours restants)
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Jour {effectivePrediction.total_days_in_month}
                </Text>
              </View>
            </View>
          )}

          {/* Key Calculated Indicators Grid */}
          {effectivePrediction && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View
                style={{
                  flex: 1,
                  minWidth: 135,
                  backgroundColor: "#F8FAFC",
                  padding: 14,
                  borderRadius: 16,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.muted }}>Rythme actuel</Text>
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.midnight }}>
                  {effectivePrediction.daily_avg_kwh.toFixed(1)} kWh/j
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  minWidth: 135,
                  backgroundColor: "#FFFBEB",
                  padding: 14,
                  borderRadius: 16,
                  gap: 4,
                  borderWidth: 1,
                  borderColor: "#FDE68A",
                }}
              >
                <Text style={{ fontSize: 11, color: "#B45309" }}>Prévision fin de mois</Text>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#B45309" }}>
                  {effectivePrediction.forecast_month_end_kwh.toFixed(0)} kWh
                </Text>
                <Text style={{ fontSize: 11, color: "#D97706", fontWeight: "700" }}>
                  +{effectivePrediction.forecast_overrun_kwh.toFixed(0)} kWh dépassement
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  minWidth: 135,
                  backgroundColor: "#F8FAFC",
                  padding: 14,
                  borderRadius: 16,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.muted }}>Quota restant autorisé</Text>
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.midnight }}>
                  {effectivePrediction.max_remaining_daily_kwh.toFixed(1)} kWh/j
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  {effectivePrediction.remaining_allowed_kwh.toFixed(0)} kWh au total
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  minWidth: 135,
                  backgroundColor: "#EFF6FF",
                  padding: 14,
                  borderRadius: 16,
                  gap: 4,
                  borderWidth: 1,
                  borderColor: "#BFDBFE",
                }}
              >
                <Text style={{ fontSize: 11, color: "#1D4ED8" }}>Réduction requise</Text>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#1D4ED8" }}>
                  -{effectivePrediction.reduction_req_pct.toFixed(1)} %
                </Text>
                <Text style={{ fontSize: 11, color: "#2563EB" }}>pour tenir l'objectif</Text>
              </View>
            </View>
          )}

          {/* Interactive What-If Scenario Controls */}
          <View
            style={{
              backgroundColor: "#F8FAFC",
              borderRadius: 18,
              padding: 16,
              gap: 14,
              borderWidth: 1,
              borderColor: "#E2E8F0",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sliders size={16} color="#64748B" />
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.midnight }}>
                Simulateur « What-If » Personnalisé
              </Text>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              {/* Target kWh */}
              <View style={{ flex: 1, minWidth: 130, gap: 6 }}>
                <Text style={{ fontSize: 11, color: colors.muted }}>Objectif mensuel (kWh)</Text>
                <TextInput
                  value={String(simTarget)}
                  onChangeText={(val) => setSimTarget(parseFloat(val) || 0)}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: "#CBD5E1",
                    borderRadius: 10,
                    padding: 8,
                    fontSize: 14,
                    fontWeight: "700",
                    color: colors.midnight,
                  }}
                />
              </View>

              {/* Current Consumed kWh */}
              <View style={{ flex: 1, minWidth: 130, gap: 6 }}>
                <Text style={{ fontSize: 11, color: colors.muted }}>Conso. au jour J (kWh)</Text>
                <TextInput
                  value={String(simCurrent)}
                  onChangeText={(val) => setSimCurrent(parseFloat(val) || 0)}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: "#CBD5E1",
                    borderRadius: 10,
                    padding: 8,
                    fontSize: 14,
                    fontWeight: "700",
                    color: colors.midnight,
                  }}
                />
              </View>

              {/* Current Day */}
              <View style={{ flex: 1, minWidth: 130, gap: 6 }}>
                <Text style={{ fontSize: 11, color: colors.muted }}>Jour du mois (1 à 30)</Text>
                <TextInput
                  value={String(simDay)}
                  onChangeText={(val) => setSimDay(Math.min(30, Math.max(1, parseInt(val) || 1)))}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: "#CBD5E1",
                    borderRadius: 10,
                    padding: 8,
                    fontSize: 14,
                    fontWeight: "700",
                    color: colors.midnight,
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* 5. Smart Alerts Center                                              */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: theme.colors.line,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.midnight }}>
                Historique des Alertes Intelligentes
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Notifications proactives de dépassement, anomalies et franchissement d'objectifs
              </Text>
            </View>
          </View>

          {alerts.length === 0 ? (
            <View
              style={{
                backgroundColor: "#F0FDF4",
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: "#BBF7D0",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <CheckCircle2 size={20} color="#16A34A" />
              <Text style={{ fontSize: 13, color: "#166534", fontWeight: "600" }}>
                Aucune alerte critique enregistrée. Votre production et consommation sont stables.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {alerts.map((al) => {
                const isOrange = al.level === "orange";
                const isRed = al.level === "red";
                const bg = isRed ? "#FEF2F2" : isOrange ? "#FFFBEB" : "#F0FDF4";
                const border = isRed ? "#FECACA" : isOrange ? "#FDE68A" : "#BBF7D0";
                const iconColor = isRed ? "#DC2626" : isOrange ? "#D97706" : "#16A34A";

                return (
                  <View
                    key={al.id}
                    style={{
                      backgroundColor: bg,
                      borderWidth: 1,
                      borderColor: border,
                      borderRadius: 16,
                      padding: 14,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                      {isRed ? (
                        <AlertCircle size={20} color={iconColor} />
                      ) : isOrange ? (
                        <AlertTriangle size={20} color={iconColor} />
                      ) : (
                        <CheckCircle2 size={20} color={iconColor} />
                      )}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: colors.midnight }}>
                          {al.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
                          {al.message}
                        </Text>
                        <Text style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
                          {al.timestamp?.replace("T", " ").slice(0, 19)}
                        </Text>
                      </View>
                    </View>

                    {!al.is_read && (
                      <Pressable
                        onPress={() => handleMarkAlertRead(al.id)}
                        style={{
                          backgroundColor: "#FFFFFF",
                          borderWidth: 1,
                          borderColor: theme.colors.line,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 10,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.midnight }}>
                          Marquer lu
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* 6. Solar AI Gemini Quick Prompts (Arabizi & French)                 */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: theme.colors.line,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Sparkles size={18} color="#D97706" />
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.midnight }}>
              Demander à Solar AI (Tunisien Arabizi & Français)
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            Notre IA analyse directement les métriques temps réel de votre ESP32 DevKit V1 et vos prévisions :
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[
              { label: "🇹🇳 Kadeh produit el panneau taw ?", q: "Kadeh produit el panneau taw ?" },
              { label: "🇹🇳 Kadeh consommation mte3i hedha chhar ?", q: "Kadeh consommation mte3i hedha chhar ?" },
              { label: "🇹🇳 Est-ce que bech net3adda el limite mte3i ?", q: "Est-ce que bech net3adda el limite mte3i hedha chhar ?" },
              { label: "🇹🇳 3lech production na9set lyoum ?", q: "3lech production na9set lyoum ?" },
              { label: "🇫🇷 Comment réduire ma conso de 20% ?", q: "Comment réduire ma consommation électrique de 20% ce mois-ci ?" },
            ].map((prompt, idx) => (
              <Pressable
                key={idx}
                onPress={() => router.push(`/chat?q=${encodeURIComponent(prompt.q)}`)}
                style={{
                  backgroundColor: "#FFF9ED",
                  borderWidth: 1.5,
                  borderColor: "#FFE29A",
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#92400E" }}>
                  {prompt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* 7. Inter-Module Navigation                                          */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <Pressable
            onPress={() => router.push("/analyse")}
            style={{
              flex: 1,
              minWidth: 160,
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.colors.line,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: colors.midnight }}>
                Facture STEG
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>Vérifier mon historique</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </Pressable>

          <Pressable
            onPress={() => router.push("/dimensionnement")}
            style={{
              flex: 1,
              minWidth: 160,
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.colors.line,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: colors.midnight }}>
                Dimensionnement
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>Ajuster la puissance kWc</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </Pressable>

          <Pressable
            onPress={() => router.push("/studio")}
            style={{
              flex: 1,
              minWidth: 160,
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.colors.line,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: colors.midnight }}>
                Solar Studio
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>Visualiser en 3D & SAM</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </Pressable>

          <Pressable
            onPress={() => router.push("/rentabilite")}
            style={{
              flex: 1,
              minWidth: 160,
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.colors.line,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: colors.midnight }}>
                Rentabilité & ROI
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>Économies en TND</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </Pressable>
        </View>
      </ScrollView>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Modal: Edit User Energy Objectives                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={isEditingObjectives}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditingObjectives(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 480,
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              padding: 24,
              gap: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.midnight }}>
              Paramétrer mes Objectifs Énergétiques
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Définissez vos plafonds pour que le moteur prédictif déclenche les alertes appropriées.
            </Text>

            <View style={{ gap: 12 }}>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.midnight }}>
                  Consommation mensuelle max (kWh)
                </Text>
                <TextInput
                  value={editTargetKwh}
                  onChangeText={setEditTargetKwh}
                  keyboardType="numeric"
                  style={{
                    borderWidth: 1,
                    borderColor: "#CBD5E1",
                    borderRadius: 12,
                    padding: 10,
                    fontSize: 14,
                    color: colors.midnight,
                  }}
                />
              </View>

              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.midnight }}>
                  Facture cible mensuelle (TND)
                </Text>
                <TextInput
                  value={editBudgetTnd}
                  onChangeText={setEditBudgetTnd}
                  keyboardType="numeric"
                  style={{
                    borderWidth: 1,
                    borderColor: "#CBD5E1",
                    borderRadius: 12,
                    padding: 10,
                    fontSize: 14,
                    color: colors.midnight,
                  }}
                />
              </View>

              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.midnight }}>
                  Production solaire mensuelle visée (kWh)
                </Text>
                <TextInput
                  value={editSolarKwh}
                  onChangeText={setEditSolarKwh}
                  keyboardType="numeric"
                  style={{
                    borderWidth: 1,
                    borderColor: "#CBD5E1",
                    borderRadius: 12,
                    padding: 10,
                    fontSize: 14,
                    color: colors.midnight,
                  }}
                />
              </View>

              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.midnight }}>
                  Objectif d'économie (%)
                </Text>
                <TextInput
                  value={editReductionPct}
                  onChangeText={setEditReductionPct}
                  keyboardType="numeric"
                  style={{
                    borderWidth: 1,
                    borderColor: "#CBD5E1",
                    borderRadius: 12,
                    padding: 10,
                    fontSize: 14,
                    color: colors.midnight,
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={() => setIsEditingObjectives(false)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: "#F1F5F9",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#64748B" }}>Annuler</Text>
              </Pressable>

              <Pressable
                onPress={handleSaveObjectives}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: theme.colors.gold,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#151515" }}>
                  Enregistrer
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ResponsiveLayout>
  );
}
