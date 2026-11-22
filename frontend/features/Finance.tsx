import React, { useState, useEffect } from "react";
import { View, Text, useWindowDimensions, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Sparkles, Sliders, ArrowRight, ShieldAlert, Award, TrendingUp, SunMedium } from "lucide-react-native";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import {
  GlassPanel,
  Title,
  Copy,
  Stepper,
  StatusIndicator,
  SolarMetric,
  PremiumButton,
  colors,
  s,
} from "../components/ui";
import { EnergyChart } from "../components/EnergyChart";
import { useSolarStore } from "../store/useSolarStore";
import { sizeSolar } from "../utils/solar";
import { calculateSolarFinancialApi, type SolarFinancialResponse } from "../services/rooftopApi";
import { theme } from "../theme";

export function FinancialProjection() {
  const router = useRouter();
  const { input } = useSolarStore();
  const wide = useWindowDimensions().width > 1100;

  // Mode: "smart" (Official STEG tariffs & Prosol subsidies) vs "manual" (Detailed custom breakdown)
  const [mode, setMode] = useState<"smart" | "manual">("smart");

  // Installed power baseline
  const result = sizeSolar(input.annual || 2400, input.area, input.watts || 450);
  const kwp = result.kwp > 0 ? result.kwp : 2.7;

  // Smart Mode State (connected to backend financial API)
  const [financialData, setFinancialData] = useState<SolarFinancialResponse | null>(null);

  // Manual Mode Detailed Cost Inputs
  const [modulesCost, setModulesCost] = useState<number>(Math.round(kwp * 1150));
  const [inverterCost, setInverterCost] = useState<number>(Math.round(kwp * 550));
  const [mountingCost, setMountingCost] = useState<number>(Math.round(kwp * 400));
  const [laborCost, setLaborCost] = useState<number>(Math.round(kwp * 450));
  const [subsidyTnd, setSubsidyTnd] = useState<number>(1500);
  const [customTariff, setCustomTariff] = useState<number>(0.34);
  const [inflationRate, setInflationRate] = useState<number>(5); // 5% annual increase in electricity prices

  // Query backend deterministic financial API
  useEffect(() => {
    let active = true;
    calculateSolarFinancialApi({
      installedKwp: kwp,
      annualConsumptionKwh: input.annual || 2400,
      location: input.location || "Tunis",
    })
      .then((res) => {
        if (active) setFinancialData(res);
      })
      .catch(() => {
        // Safe offline fallback
      });

    return () => {
      active = false;
    };
  }, [kwp, input.annual, input.location]);

  // Compute metrics based on active mode
  const grossInvestment = mode === "smart"
    ? (financialData?.cost_breakdown.total_investment_tnd || Math.round(kwp * 2650))
    : (modulesCost + inverterCost + mountingCost + laborCost);

  const netInvestment = mode === "smart"
    ? (financialData?.cost_breakdown.net_investment_after_subsidy_tnd || (grossInvestment - 1500))
    : Math.max(500, grossInvestment - subsidyTnd);

  const annualProduction = financialData?.roi.annual_savings_tnd
    ? Math.round(kwp * 1650)
    : Math.round(kwp * 1650);

  const annualSavings = mode === "smart"
    ? (financialData?.roi.annual_savings_tnd || Math.round(annualProduction * 0.32))
    : Math.round(annualProduction * customTariff);

  const paybackYears = annualSavings > 0
    ? Number((netInvestment / annualSavings).toFixed(1))
    : 0;

  // 25-Year Cumulative Cashflow Array
  const points = Array.from({ length: 26 }, (_, year) => {
    if (year === 0) return { year: 0, value: -netInvestment };
    let cum = -netInvestment;
    for (let y = 1; y <= year; y++) {
      const infl = Math.pow(1 + (mode === "smart" ? 0.045 : inflationRate / 100), y - 1);
      const degradation = Math.max(0.8, 1 - (y - 1) * 0.005);
      const maintenance = grossInvestment * 0.008; // 0.8% annual maintenance
      const netSavingsYear = (annualSavings * infl * degradation) - maintenance;
      cum += netSavingsYear;
    }
    return { year, value: Math.round(cum) };
  });

  const twentyFiveYearNetProfit = points[25]?.value ?? 0;
  const co2AvoidedTons = Number((kwp * 1.65 * 0.65).toFixed(1));

  return (
    <View style={{ gap: 24 }}>
      {/* Segmented Mode Selector */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#FFF9ED",
          borderWidth: 1.5,
          borderColor: "#FFE29A",
          borderRadius: 20,
          padding: 4,
          maxWidth: 650,
        }}
      >
        <Pressable
          onPress={() => setMode("smart")}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 16,
            backgroundColor: mode === "smart" ? "#FFB800" : "transparent",
          }}
        >
          <Sparkles size={16} color={mode === "smart" ? "#17212E" : "#8A7A6A"} />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: mode === "smart" ? "#17212E" : "#8A7A6A",
            }}
          >
            Mode Intelligent (STEG & Prosol)
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setMode("manual")}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 16,
            backgroundColor: mode === "manual" ? "#FFB800" : "transparent",
          }}
        >
          <Sliders size={16} color={mode === "manual" ? "#17212E" : "#8A7A6A"} />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: mode === "manual" ? "#17212E" : "#8A7A6A",
            }}
          >
            Mode Manuel (Coûts détaillés)
          </Text>
        </Pressable>
      </View>

      {/* Top Key Metrics */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <SolarMetric
          label="Investissement net"
          value={netInvestment}
          unit="TND"
          note={mode === "smart" ? "Subvention ANME Prosol déduite (-1 500 TND)" : `Brut: ${grossInvestment} TND - Subvention: ${subsidyTnd} TND`}
        />
        <SolarMetric
          label="Économie annuelle brute"
          value={annualSavings}
          unit="TND/an"
          note={`Production valorisée (${annualProduction} kWh/an)`}
        />
        <GlassPanel style={{ flex: 1, minWidth: 200 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
            Retour sur investissement
          </Text>
          <Text
            style={{
              fontSize: 34,
              color: "#D97706",
              fontWeight: "900",
              letterSpacing: -1,
              marginTop: 6,
            }}
          >
            {paybackYears > 0 ? `${paybackYears} ans` : "Inconnu"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            Rentabilité accélérée par le fort ensoleillement
          </Text>
        </GlassPanel>
      </View>

      {/* Main Analysis & Controls */}
      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        {/* Left Column: 25-Year Projection Chart */}
        <GlassPanel style={{ flex: 1 }}>
          <Title>25 ans de perspective solaire financière.</Title>
          <Copy>
            Solde financier net cumulé après amortissement total de votre installation photovoltaïque · TND
          </Copy>

          <View style={{ marginVertical: 12 }}>
            <EnergyChart
              values={points.map((p) => p.value)}
              labels={points.map((p) => `An ${p.year}`)}
              unit="TND"
              height={250}
            />
          </View>

          <View
            style={[
              s.row,
              {
                justifyContent: "space-between",
                flexWrap: "wrap",
                backgroundColor: "#FFF9ED",
                borderWidth: 1.5,
                borderColor: "#FFE29A",
                padding: 16,
                borderRadius: 18,
                marginTop: 8,
              },
            ]}
          >
            <View>
              <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>
                Bénéfice net total cumulé à 25 ans
              </Text>
              <Text style={{ color: colors.midnight, fontSize: 26, fontWeight: "900" }}>
                +{twentyFiveYearNetProfit.toLocaleString("fr-FR")} TND
              </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>
                Impact environnemental certifié
              </Text>
              <Text style={{ color: theme.colors.greenDark, fontSize: 16, fontWeight: "800" }}>
                {co2AvoidedTons} tonnes de CO₂ évitées / an
              </Text>
            </View>
          </View>

          {/* Legal disclaimer on STEG fixed fees */}
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              backgroundColor: "#FFFBEB",
              borderWidth: 1,
              borderColor: "#FDE68A",
              borderRadius: 14,
              padding: 14,
              marginTop: 14,
              alignItems: "center",
            }}
          >
            <ShieldAlert size={20} color="#D97706" />
            <Text style={{ fontSize: 12, color: "#92400E", flex: 1, lineHeight: 16 }}>
              <Text style={{ fontWeight: "700" }}>Rappel réglementaire officiel :</Text> Même avec une production couvrant 100% de vos besoins énergétiques, les redevances fixes de raccordement compteur STEG et taxes municipales restent légalement dues (~6 à 12 DT par facture bimestrielle).
            </Text>
          </View>
        </GlassPanel>

        {/* Right Column: Settings / Detailed Cost Controls */}
        <GlassPanel style={{ width: wide ? 360 : undefined, gap: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.midnight }}>
            {mode === "smart" ? "Hypothèses Officielles" : "Paramétrage des Coûts"}
          </Text>

          {mode === "smart" ? (
            /* Mode Intelligent Info Cards */
            <View style={{ gap: 12 }}>
              <View
                style={{
                  backgroundColor: "#FFF9ED",
                  borderWidth: 1,
                  borderColor: "#FFE29A",
                  borderRadius: 14,
                  padding: 12,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#8A7A6A", textTransform: "uppercase" }}>
                  Dispositif Prosol Élec ANME
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#17212E" }}>
                  Subvention de 1 500 TND accordée
                </Text>
                <Text style={{ fontSize: 12, color: "#6A5E52" }}>
                  Financement bancaire échelonné directement prélevé sur votre facture STEG (taux préférentiel sur 7 à 10 ans).
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: "#FFF9ED",
                  borderWidth: 1,
                  borderColor: "#FFE29A",
                  borderRadius: 14,
                  padding: 12,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#8A7A6A", textTransform: "uppercase" }}>
                  Barème Tarifaire STEG
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#17212E" }}>
                  Basse Tension Palier 4 (0,341 DT/kWh)
                </Text>
                <Text style={{ fontSize: 12, color: "#6A5E52" }}>
                  Autoconsommation valorisée au tarif d'achat évité le plus élevé avec injection de surplus selon le décret 2016-1123.
                </Text>
              </View>
            </View>
          ) : (
            /* Mode Manuel Detailed Controls */
            <View style={{ gap: 10 }}>
              <Stepper
                label="Panneaux photovoltaïques (TND)"
                value={modulesCost}
                min={1000}
                max={15000}
                step={250}
                unit="TND"
                onChange={setModulesCost}
              />
              <Stepper
                label="Onduleur réseau & protections (TND)"
                value={inverterCost}
                min={500}
                max={8000}
                step={200}
                unit="TND"
                onChange={setInverterCost}
              />
              <Stepper
                label="Structure & câblage solaire (TND)"
                value={mountingCost}
                min={300}
                max={5000}
                step={100}
                unit="TND"
                onChange={setMountingCost}
              />
              <Stepper
                label="Main d'œuvre & raccordement (TND)"
                value={laborCost}
                min={300}
                max={4000}
                step={100}
                unit="TND"
                onChange={setLaborCost}
              />
              <Stepper
                label="Subvention ANME déduite (TND)"
                value={subsidyTnd}
                min={0}
                max={3000}
                step={250}
                unit="TND"
                onChange={setSubsidyTnd}
              />
              <Stepper
                label="Tarif évité moyen (TND/kWh)"
                value={customTariff}
                min={0.15}
                max={0.60}
                step={0.02}
                unit="DT/kWh"
                onChange={setCustomTariff}
              />
              <Stepper
                label="Hausse annuelle tarif électricité (%)"
                value={inflationRate}
                min={1}
                max={10}
                step={1}
                unit="%"
                onChange={setInflationRate}
              />
            </View>
          )}

          {/* Direct Navigation Buttons */}
          <View style={{ gap: 10, marginTop: 12 }}>
            <PremiumButton
              title="Ajuster l'implantation Toiture"
              onPress={() => router.push("/studio")}
            />
            <PremiumButton
              title="Modifier le Dimensionnement"
              secondary
              onPress={() => router.push("/dimensionnement")}
            />
            <PremiumButton
              title="Consulter les Installateurs Agréés"
              secondary
              onPress={() => router.push("/chat")}
            />
          </View>
        </GlassPanel>
      </View>
    </View>
  );
}

export default function Finance() {
  return (
    <ResponsiveLayout>
      <View style={{ gap: 8, marginBottom: 26 }}>
        <StatusIndicator label="Module 04 · Rentabilité & Projection Financière 25 ans" />
        <Title>Un investissement rentable, transparent et durable.</Title>
        <Copy>
          Calculez précisément vos économies avec les barèmes STEG et les subventions Prosol Élec, ou ajustez vos hypothèses financières manuellement.
        </Copy>
      </View>
      <FinancialProjection />
    </ResponsiveLayout>
  );
}
