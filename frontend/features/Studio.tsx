import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Sparkles,
  Sliders,
  Plus,
  RotateCw,
  Trash2,
  Copy,
  Undo2,
  Redo2,
  Layers,
  Eye,
  EyeOff,
  Check,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Wand2,
  FileSpreadsheet,
  AlertCircle,
  Info,
  Sun,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  Compass,
  Download,
  Ruler,
  ShieldCheck,
  Zap,
} from "lucide-react-native";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { RoofStudioCanvas, type StudioViewMode } from "../components/RoofStudioCanvas";
import { FileUpload, type LocalFile } from "../components/FileUpload";
import {
  GlassPanel,
  Title,
  Copy as UICopy,
  StatusIndicator,
  PremiumButton,
  s,
  colors,
} from "../components/ui";
import { theme } from "../theme";
import { useSolarStore, PANEL_LIBRARY, type PanelModel } from "../store/useSolarStore";
import {
  segmentRooftopSam,
  planRooftopSolar,
  validateRooftopPanels,
  recommendRooftopStrategies,
  calibrateRooftop,
  checkBackendHealth,
  ensureImageBase64,
  normalizeImageDataUri,
  type PlacedPanel,
  type RooftopAnalysisResponse,
  type SamSegmentResponse,
  type SamPlanResponse,
  type SolarProposal,
} from "../services/rooftopApi";
import { DEMO_ROOF_B64 } from "../assets/demoRoof";

export default function Studio() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1050;

  const {
    input,
    rooftopPhoto,
    activeMode,
    manualPanels,
    selectedPanelId,
    showMask,
    showContours,
    panelModel,
    undoStack,
    redoStack,
    set,
  } = useSolarStore();

  const [file, setFile] = useState<LocalFile | null>(
    rooftopPhoto ? { uri: rooftopPhoto, name: "Toiture.jpg", image: true } : null
  );

  // 6-View Tab Modes: "original" | "masks" | "safe_zone" | "plan" | "realistic" | "3d"
  const [activeView, setActiveView] = useState<StudioViewMode>("plan");

  // SAM AI & Placement Engine state
  const [samSegmentResult, setSamSegmentResult] = useState<SamSegmentResponse | null>(null);
  const [samPlanResult, setSamPlanResult] = useState<SamPlanResponse | null>(null);
  const [realisticRenderB64, setRealisticRenderB64] = useState<string | null>(null);
  const [samOverlayB64, setSamOverlayB64] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState<number>(0); // 0=idle, 1=load, 2=sam, 3=obstacles, 4=render/done
  const [analyzingState, setAnalyzingState] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [backendReady, setBackendReady] = useState(false);

  // Multi-Strategy AI Proposals (Économique, Équilibrée, Maximale)
  const [proposals, setProposals] = useState<SolarProposal[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<string>("balanced");

  // Calibration State
  const [showCalibModal, setShowCalibModal] = useState(false);
  const [knownLengthM, setKnownLengthM] = useState<string>("10");
  const [knownWidthM, setKnownWidthM] = useState<string>("8.5");
  const [isCalibrated, setIsCalibrated] = useState(false);

  // Check backend and GPU readiness
  useEffect(() => {
    checkBackendHealth().then((res) => {
      setBackendReady(res.healthy);
    });
  }, []);

  // Sync photo with file only when uri actually changes
  useEffect(() => {
    if (file?.uri && file.uri !== rooftopPhoto) {
      useSolarStore.getState().set({ rooftopPhoto: file.uri });
    }
  }, [file?.uri, rooftopPhoto]);

  // Current active panels in canvas
  const displayPanels = useMemo(() => {
    if (activeMode === "ai") {
      if (samPlanResult && samPlanResult.panels.length > 0) {
        const [imgW, imgH] = samPlanResult.dimensions;
        return samPlanResult.panels.map((p) => ({
          id: p.id,
          x_pct: round2((p.x / imgW) * 100),
          y_pct: round2((p.y / imgH) * 100),
          w_pct: round2((p.w / imgW) * 100),
          h_pct: round2((p.h / imgH) * 100),
          rotation: p.rotation_deg,
          valid: p.is_valid,
          power_w: samPlanResult.panel_wattage_w,
        }));
      }
      return [];
    }
    return manualPanels;
  }, [activeMode, samPlanResult, manualPanels]);

  function round2(v: number): number {
    return Math.round(v * 100) / 100;
  }

  // Record history with local collision validation
  const recordHistory = useCallback(
    (newPanels: PlacedPanel[]) => {
      const validated = checkLocalCollisions(newPanels);
      set({
        undoStack: [[...manualPanels], ...(undoStack || []).slice(0, 15)],
        redoStack: [],
        manualPanels: validated,
      });
    },
    [manualPanels, undoStack, set]
  );

  // Local collision detection between panels
  function checkLocalCollisions(panels: PlacedPanel[]): PlacedPanel[] {
    const overlapping = new Set<string>();
    for (let i = 0; i < panels.length; i++) {
      for (let j = i + 1; j < panels.length; j++) {
        const p1 = panels[i]!;
        const p2 = panels[j]!;

        const w1 = p1.rotation === 90 ? p1.h_pct : p1.w_pct;
        const h1 = p1.rotation === 90 ? p1.w_pct : p1.h_pct;
        const w2 = p2.rotation === 90 ? p2.h_pct : p2.w_pct;
        const h2 = p2.rotation === 90 ? p2.w_pct : p2.h_pct;

        const overlapX = p1.x_pct < p2.x_pct + w2 && p1.x_pct + w1 > p2.x_pct;
        const overlapY = p1.y_pct < p2.y_pct + h2 && p1.y_pct + h1 > p2.y_pct;

        if (overlapX && overlapY) {
          overlapping.add(p1.id);
          overlapping.add(p2.id);
        }
      }
    }

    return panels.map((p) => ({
      ...p,
      valid:
        !overlapping.has(p.id) &&
        p.x_pct >= 2 &&
        p.y_pct >= 2 &&
        p.x_pct + p.w_pct <= 98 &&
        p.y_pct + p.h_pct <= 98,
    }));
  }

  // Undo action
  const handleUndo = useCallback(() => {
    if (!undoStack || undoStack.length === 0) return;
    const previous = undoStack[0]!;
    const newUndo = undoStack.slice(1);
    set({
      redoStack: [[...manualPanels], ...(redoStack || [])],
      undoStack: newUndo,
      manualPanels: previous,
    });
  }, [undoStack, redoStack, manualPanels, set]);

  // Redo action
  const handleRedo = useCallback(() => {
    if (!redoStack || redoStack.length === 0) return;
    const next = redoStack[0]!;
    const newRedo = redoStack.slice(1);
    set({
      undoStack: [[...manualPanels], ...(undoStack || [])],
      redoStack: newRedo,
      manualPanels: next,
    });
  }, [undoStack, redoStack, manualPanels, set]);

  // Trigger SAM ViT-B Segmentation, Placement, and 3-Strategy Recommendations
  async function runSamAnalysis(photoUriToAnalyze?: string) {
    const targetUri = photoUriToAnalyze || file?.uri || rooftopPhoto;
    if (!targetUri) {
      setStatusMessage("Veuillez sélectionner ou importer une photographie de toiture.");
      return;
    }

    setAnalyzingState(true);
    setAnalysisStep(1);
    setStatusMessage("Étape 1/4 : Chargement de la photographie de toiture...");

    try {
      const targetPanels = Math.max(
        4,
        Math.min(
          30,
          Math.ceil((input.annual || 3600) / 1650 / ((panelModel?.power_w || input.watts || 450) / 1000))
        )
      );

      // STEP 2: SAM Segmentation
      setAnalysisStep(2);
      setStatusMessage("Étape 2/4 : Repérage de la toiture avec SAM ViT-B...");
      const segRes = await segmentRooftopSam(targetUri, targetPanels);
      setSamSegmentResult(segRes);

      if (segRes.overlay_b64) {
        setSamOverlayB64(normalizeImageDataUri(segRes.overlay_b64));
      }

      // STEP 3: Calepinage & Recommandations multi-stratégies
      setAnalysisStep(3);
      setStatusMessage("Étape 3/4 : Calcul des 3 stratégies d'implantation...");

      const recRes = await recommendRooftopStrategies({
        imageB64: targetUri,
        annualKwh: input.annual || 3600,
        roofMaskId: segRes.recommended_roof_mask_id,
        obstacleMaskIds: segRes.obstacles_detected,
        panelWattageW: panelModel?.power_w || 450,
      });

      if (recRes.proposals && recRes.proposals.length > 0) {
        setProposals(recRes.proposals);
        const balanced =
          recRes.proposals.find((p) => p.id === "balanced") || recRes.proposals[0]!;
        setSelectedProposalId(balanced.id);

        if (balanced.realistic_render_b64) {
          setRealisticRenderB64(normalizeImageDataUri(balanced.realistic_render_b64));
        }

        // Map initial panels
        const [imgW, imgH] = balanced.dimensions;
        const initialPanels: PlacedPanel[] = balanced.panels.map((p) => ({
          id: p.id,
          x_pct: round2((p.x / imgW) * 100),
          y_pct: round2((p.y / imgH) * 100),
          w_pct: round2((p.w / imgW) * 100),
          h_pct: round2((p.h / imgH) * 100),
          rotation: p.rotation_deg,
          valid: p.is_valid,
          power_w: balanced.panel_wattage_w,
        }));

        set({
          activeMode: "ai",
          manualPanels: initialPanels,
          selectedPanelId: initialPanels[0]?.id || null,
        });
      }

      // STEP 4: Initial Plan Res
      setAnalysisStep(4);
      setStatusMessage("Étape 4/4 : Rendu photoréaliste et validation des contraintes...");

      const planRes = await planRooftopSolar({
        imageB64: targetUri,
        roofMaskId: segRes.recommended_roof_mask_id,
        obstacleMaskIds: segRes.obstacles_detected,
        desiredPanels: targetPanels,
        panelWattageW: panelModel?.power_w || 450,
        orientation: "portrait",
      });

      setSamPlanResult(planRes);

      if (planRes.realistic_render_b64) {
        setRealisticRenderB64(normalizeImageDataUri(planRes.realistic_render_b64));
        setActiveView("realistic"); // Default to photorealistic view once loaded!
      }

      setStatusMessage(
        `✓ Analyse réussie : toiture repérée et ${planRes.panels_placed} panneaux implantés.`
      );
      setTimeout(() => setStatusMessage(""), 5000);
    } catch (err: any) {
      console.error("[Studio] runSamAnalysis failed:", err);
      setStatusMessage(
        "L'analyse automatique n'a pas pu aboutir. Vous pouvez positionner vos panneaux manuellement."
      );
    } finally {
      setAnalyzingState(false);
      setAnalysisStep(0);
    }
  }

  // Apply one of the 3 AI Strategy proposals
  const applyProposal = (proposal: SolarProposal) => {
    setSelectedProposalId(proposal.id);
    if (proposal.realistic_render_b64) {
      setRealisticRenderB64(normalizeImageDataUri(proposal.realistic_render_b64));
    }
    const [imgW, imgH] = proposal.dimensions;
    const mapped: PlacedPanel[] = proposal.panels.map((p) => ({
      id: p.id,
      x_pct: round2((p.x / imgW) * 100),
      y_pct: round2((p.y / imgH) * 100),
      w_pct: round2((p.w / imgW) * 100),
      h_pct: round2((p.h / imgH) * 100),
      rotation: p.rotation_deg,
      valid: p.is_valid,
      power_w: proposal.panel_wattage_w,
    }));
    set({
      activeMode: "ai",
      manualPanels: mapped,
      selectedPanelId: mapped[0]?.id || null,
    });
  };

  // Perform dimension calibration
  const handleCalibrate = async () => {
    if (!rooftopPhoto) return;
    try {
      const lenM = parseFloat(knownLengthM) || 10;
      const widM = parseFloat(knownWidthM) || 8.5;
      const res = await calibrateRooftop({
        imageB64: rooftopPhoto,
        knownLengthM: lenM,
        knownWidthM: widM,
        realRoofAreaM2: lenM * widM,
      });
      setIsCalibrated(res.calibrated);
      setShowCalibModal(false);
      setStatusMessage(res.message);
      setTimeout(() => setStatusMessage(""), 4000);
    } catch (err: any) {
      console.warn("Calibration error:", err);
    }
  };

  // Load sample demo roof (Villa Moderne)
  function loadDemoRoof() {
    const sampleUri = DEMO_ROOF_B64;
    const sampleObj: LocalFile = {
      uri: sampleUri,
      name: "Villa_Moderne_Toit_85m2.jpg",
      image: true,
    };
    setFile(sampleObj);
    set({ rooftopPhoto: sampleUri });
    runSamAnalysis(sampleUri);
  }

  // Switch to Manual Mode
  function handleCustomizeAi() {
    set({ activeMode: "manual" });
    setActiveView("plan");
  }

  // Restore AI Initial Proposal
  function handleRestoreAiProposal() {
    if (proposals.length > 0) {
      const balanced = proposals.find((p) => p.id === "balanced") || proposals[0]!;
      applyProposal(balanced);
    }
  }

  // Manual Panel Operations
  const handleAddPanel = () => {
    const nextIdx = manualPanels.length + 1;
    const newPanel: PlacedPanel = {
      id: `p_${Date.now()}`,
      x_pct: 35 + ((nextIdx % 4) * 8),
      y_pct: 30 + Math.floor(nextIdx / 4) * 14,
      w_pct: 12,
      h_pct: 18,
      rotation: 0,
      valid: true,
      power_w: panelModel.power_w,
    };
    recordHistory([...manualPanels, newPanel]);
    set({ selectedPanelId: newPanel.id });
  };

  // Add a whole row of 4 panels
  const handleAddRow = () => {
    const newBatch: PlacedPanel[] = [];
    const baseId = Date.now();
    for (let c = 0; c < 4; c++) {
      newBatch.push({
        id: `p_${baseId}_${c}`,
        x_pct: 20 + c * 14,
        y_pct: 45,
        w_pct: 12,
        h_pct: 18,
        rotation: 0,
        valid: true,
        power_w: panelModel.power_w,
      });
    }
    recordHistory([...manualPanels, ...newBatch]);
  };

  const handleRotateSelected = () => {
    if (!selectedPanelId) return;
    const updated = manualPanels.map((p) =>
      p.id === selectedPanelId
        ? { ...p, rotation: p.rotation === 0 ? 90 : 0 }
        : p
    );
    recordHistory(updated);
  };

  const handleDuplicateSelected = () => {
    if (!selectedPanelId) return;
    const target = manualPanels.find((p) => p.id === selectedPanelId);
    if (!target) return;
    const clone: PlacedPanel = {
      ...target,
      id: `p_${Date.now()}`,
      x_pct: Math.min(85, target.x_pct + 8),
      y_pct: Math.min(85, target.y_pct + 8),
    };
    recordHistory([...manualPanels, clone]);
    set({ selectedPanelId: clone.id });
  };

  const handleDeleteSelected = () => {
    if (!selectedPanelId) return;
    const filtered = manualPanels.filter((p) => p.id !== selectedPanelId);
    recordHistory(filtered);
    set({ selectedPanelId: filtered[0]?.id || null });
  };

  const handleSelectPanel = (id: string | null) => {
    set({ selectedPanelId: id });
  };

  const handleUpdatePanel = (updated: PlacedPanel) => {
    const newPanels = manualPanels.map((p) => (p.id === updated.id ? updated : p));
    const validated = checkLocalCollisions(newPanels);
    set({ manualPanels: validated });
  };

  // Export / Download rendered view
  const handleExportPlan = () => {
    const imageToExport = realisticRenderB64 || rooftopPhoto;
    if (Platform.OS === "web" && imageToExport) {
      const link = document.createElement("a");
      link.href = imageToExport;
      link.download = `SmartSolar_Plan_Toiture_${Date.now()}.png`;
      link.click();
    }
  };

  // Live Technical Metrics for Manual Mode
  const manualMetrics = useMemo(() => {
    const validCount = manualPanels.filter((p) => p.valid !== false).length;
    const totalCount = manualPanels.length;
    const kwp = round2((validCount * panelModel.power_w) / 1000);
    const prodKwh = Math.round(kwp * 1650);
    const coverage =
      input.annual && input.annual > 0
        ? Math.min(100, Math.round((prodKwh / input.annual) * 100))
        : 85;
    const annualSavings = Math.round(prodKwh * 0.34);
    const cost = Math.max(800, Math.round(kwp * 2650) - 1500);
    const roi = annualSavings > 0 ? (cost / annualSavings).toFixed(1) : "4.8";

    return {
      validCount,
      totalCount,
      kwp,
      prodKwh,
      coverage,
      annualSavings,
      cost,
      roi,
    };
  }, [manualPanels, panelModel, input.annual]);

  return (
    <ResponsiveLayout>
      <View
        style={{
          flexDirection: isDesktop ? "row" : "column",
          gap: 24,
          paddingBottom: 40,
        }}
      >
        {/* Left Column: Visual CAD Workspace & Canvas */}
        <View style={{ flex: isDesktop ? 7 : undefined, gap: 14 }}>
          {/* Header Row: Title + Status + View Tabs */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <View>
              <Title>Solar Design Studio</Title>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Logiciel intelligent de conception et calepinage photovoltaïque
              </Text>
            </View>

            {/* Calibration Status Pill */}
            <Pressable
              onPress={() => setShowCalibModal((m) => !m)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 14,
                backgroundColor: isCalibrated ? "#ECFDF5" : "#FFF9ED",
                borderWidth: 1,
                borderColor: isCalibrated ? "#10B981" : "#FFB800",
              }}
            >
              <Ruler size={13} color={isCalibrated ? "#047857" : "#D97706"} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: isCalibrated ? "#047857" : "#92400E",
                }}
              >
                {isCalibrated ? "Toiture Calibrée (Métrique)" : "Calibrer les dimensions"}
              </Text>
            </Pressable>
          </View>

          {/* Calibration Modal / Dropdown */}
          {showCalibModal && (
            <GlassPanel style={{ padding: 14, gap: 10, backgroundColor: "#FFFDF7" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ruler size={16} color="#D97706" />
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#17212E" }}>
                  Calibration des dimensions réelles de la toiture
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Renseignez les dimensions mesurées pour convertir les pixels en surface réelle métrique.
              </Text>
              <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#17212E" }}>Longueur (m) :</Text>
                  <TextInput
                    value={knownLengthM}
                    onChangeText={setKnownLengthM}
                    keyboardType="numeric"
                    style={{
                      borderWidth: 1,
                      borderColor: theme.colors.line,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      width: 90,
                      backgroundColor: "#FFFFFF",
                      fontSize: 13,
                    }}
                  />
                </View>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#17212E" }}>Largeur (m) :</Text>
                  <TextInput
                    value={knownWidthM}
                    onChangeText={setKnownWidthM}
                    keyboardType="numeric"
                    style={{
                      borderWidth: 1,
                      borderColor: theme.colors.line,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      width: 90,
                      backgroundColor: "#FFFFFF",
                      fontSize: 13,
                    }}
                  />
                </View>
                <View style={{ justifyContent: "flex-end" }}>
                  <PremiumButton title="Appliquer la calibration" onPress={handleCalibrate} />
                </View>
              </View>
            </GlassPanel>
          )}

          {/* 6-View Tab Switcher */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "rgba(23, 33, 46, 0.08)",
              borderRadius: 14,
              padding: 4,
              gap: 4,
              flexWrap: "wrap",
            }}
          >
            {[
              { id: "original", label: "1. Photo", icon: ImageIcon },
              { id: "masks", label: "2. Masques SAM", icon: Layers },
              { id: "safe_zone", label: "3. Zones utiles", icon: CheckCircle2 },
              { id: "plan", label: "4. Plan 2D", icon: Sliders },
              { id: "realistic", label: "5. Rendu Réaliste", icon: Sparkles },
              { id: "3d", label: "6. Solar 3D", icon: Compass },
            ].map((v) => {
              const IconCmp = v.icon;
              const isSelected = activeView === v.id;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setActiveView(v.id as StudioViewMode)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 10,
                    backgroundColor: isSelected ? "#FFB800" : "transparent",
                  }}
                >
                  <IconCmp size={13} color={isSelected ? "#17212E" : "#8A7A6A"} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: isSelected ? "#17212E" : "#8A7A6A",
                    }}
                  >
                    {v.label}
                  </Text>
                </Pressable>
              );
            })}

            {/* Quick Demo Button */}
            <Pressable
              onPress={loadDemoRoof}
              style={{
                marginLeft: "auto",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 10,
                backgroundColor: "#FFF9ED",
                borderWidth: 1,
                borderColor: "#FFE29A",
              }}
            >
              <Wand2 size={13} color="#D97706" />
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400E" }}>
                Toiture Démo (85 m²)
              </Text>
            </Pressable>
          </View>

          {/* Interactive Roof Canvas Workspace */}
          <RoofStudioCanvas
            photoUri={rooftopPhoto}
            mode={activeMode}
            analysis={null}
            panels={displayPanels}
            selectedId={selectedPanelId}
            showMask={showMask}
            showContours={showContours}
            activeView={activeView}
            realisticRenderUri={realisticRenderB64}
            samOverlayUri={samOverlayB64}
            roofPolygon={samPlanResult?.roof_polygon as any}
            obstaclePolygons={samPlanResult?.obstacle_polygons as any}
            onSelectPanel={handleSelectPanel}
            onUpdatePanel={handleUpdatePanel}
            onRetryAnalysis={() => runSamAnalysis()}
          />

          {/* Autonomous Manual CAD Editing Toolbar */}
          {activeMode === "manual" && (
            <GlassPanel style={{ padding: 16 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: "#8A7A6A",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  Outils de Calepinage Manuel
                </Text>
                <Text style={{ fontSize: 11, color: "#D97706", fontWeight: "700" }}>
                  Déplacez les modules à la souris · Collision en rouge
                </Text>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <PremiumButton title="+ 1 Module" onPress={handleAddPanel} />
                <PremiumButton title="+ Rangée (4 Modules)" secondary onPress={handleAddRow} />
                <PremiumButton
                  title="Pivoter 90°"
                  secondary
                  disabled={!selectedPanelId}
                  onPress={handleRotateSelected}
                />
                <PremiumButton
                  title="Dupliquer"
                  secondary
                  disabled={!selectedPanelId}
                  onPress={handleDuplicateSelected}
                />
                <PremiumButton
                  title="Supprimer"
                  secondary
                  disabled={!selectedPanelId}
                  onPress={handleDeleteSelected}
                />
                <PremiumButton
                  title="Annuler"
                  secondary
                  disabled={!undoStack?.length}
                  onPress={handleUndo}
                />
                <PremiumButton
                  title="Rétablir"
                  secondary
                  disabled={!redoStack?.length}
                  onPress={handleRedo}
                />
                <PremiumButton
                  title="Exporter le plan (PNG)"
                  secondary
                  onPress={handleExportPlan}
                />
              </View>
            </GlassPanel>
          )}

          {/* Photo Uploader Card */}
          <GlassPanel style={{ padding: 18, gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#17212E" }}>
                Photographie Aérienne ou Vue Satellite
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: backendReady ? "#10B981" : "#F59E0B",
                  }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    color: backendReady ? "#047857" : "#B45309",
                    fontWeight: "700",
                  }}
                >
                  {backendReady ? "SAM AI ViT-B (CUDA) Connecté" : "Serveur en cours..."}
                </Text>
              </View>
            </View>

            <FileUpload
              imageOnly
              file={file}
              onFile={(f) => {
                setFile(f);
                if (f?.uri) {
                  set({ rooftopPhoto: f.uri });
                  runSamAnalysis(f.uri);
                }
              }}
            />

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
              <PremiumButton
                title={analyzingState ? "Analyse de la toiture..." : "Lancer l'analyse SAM"}
                disabled={!file?.uri || analyzingState}
                onPress={() => runSamAnalysis()}
              />
              <PremiumButton
                title="Charger Toiture Démo"
                secondary
                onPress={loadDemoRoof}
              />
            </View>
          </GlassPanel>
        </View>

        {/* Right Column: AI Recommendations, Strategies & Dynamic KPIs */}
        <View style={{ flex: isDesktop ? 5 : undefined, gap: 18 }}>
          {/* MODE 1: 3-Strategy Comparison Cards */}
          <GlassPanel style={{ padding: 20, gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Sparkles size={20} color="#D97706" />
              <Title>Stratégies d'Implantation</Title>
            </View>

            {analyzingState ? (
              <View style={{ padding: 26, alignItems: "center", gap: 12 }}>
                <ActivityIndicator size="large" color="#FFB800" />
                <Text
                  style={{
                    fontSize: 13,
                    color: "#92400E",
                    fontWeight: "700",
                    textAlign: "center",
                  }}
                >
                  {statusMessage || "Calcul du plan de placement et des masques..."}
                </Text>
              </View>
            ) : proposals.length > 0 ? (
              <View style={{ gap: 10 }}>
                {proposals.map((prop) => {
                  const isSelected = selectedProposalId === prop.id;
                  return (
                    <Pressable
                      key={prop.id}
                      onPress={() => applyProposal(prop)}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        backgroundColor: isSelected ? "#FFF9ED" : "#FFFFFF",
                        borderWidth: 1.5,
                        borderColor: isSelected ? "#FFB800" : theme.colors.line,
                        gap: 6,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color: isSelected ? "#92400E" : "#17212E",
                            }}
                          >
                            {prop.title}
                          </Text>
                          <View
                            style={{
                              backgroundColor:
                                prop.id === "balanced"
                                  ? "#10B981"
                                  : prop.id === "eco"
                                  ? "#38BDF8"
                                  : "#D97706",
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 10,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: "800", color: "#FFFFFF" }}>
                              {prop.tag}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: "#D97706" }}>
                          {prop.installed_kwp} kWc
                        </Text>
                      </View>

                      <Text style={{ fontSize: 11, color: colors.muted, lineHeight: 16 }}>
                        {prop.explanation}
                      </Text>

                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginTop: 4,
                          paddingTop: 6,
                          borderTopWidth: 1,
                          borderTopColor: "rgba(0,0,0,0.06)",
                        }}
                      >
                        <Text style={{ fontSize: 11, color: colors.muted }}>
                          {prop.panels_placed} modules · {prop.annual_production_kwh} kWh/an
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#047857" }}>
                          Économie : {prop.annual_savings_tnd} TND/an (~{prop.payback_years} ans)
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={{ padding: 16, alignItems: "center", gap: 8 }}>
                <Text style={{ color: colors.muted, textAlign: "center", fontSize: 12 }}>
                  Importez une photo ou chargez la toiture démo pour calculer les 3 recommandations automatiques.
                </Text>
                <PremiumButton title="Essayer avec Toiture Démo" onPress={loadDemoRoof} />
              </View>
            )}
          </GlassPanel>

          {/* Panel Model Selector */}
          <GlassPanel style={{ padding: 18, gap: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#17212E" }}>
              Bibliothèque de Modules Photovoltaïques :
            </Text>
            {PANEL_LIBRARY.map((model) => {
              const selected = panelModel.name === model.name;
              return (
                <Pressable
                  key={model.name}
                  onPress={() => set({ panelModel: model })}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: selected ? "#FFF9ED" : "#FFFFFF",
                    borderWidth: 1.5,
                    borderColor: selected ? "#FFB800" : theme.colors.line,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: selected ? "#92400E" : "#17212E",
                      }}
                    >
                      {model.name}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#D97706" }}>
                      {model.power_w} W
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                    {model.width_m} m × {model.height_m} m · {model.power_w >= 450 ? "Bifacial N-Type" : "Monocristallin"}
                  </Text>
                </Pressable>
              );
            })}
          </GlassPanel>

          {/* Dynamic Technical Indicators Card */}
          <GlassPanel style={{ padding: 18, gap: 10, backgroundColor: "#FFF9ED", borderColor: "#FFE29A" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Zap size={18} color="#D97706" />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: "#92400E",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                Bilan Technique & Financier en Direct
              </Text>
            </View>

            {[
              ["Modules implantés", `${displayPanels.length} panneaux photovoltaïques`],
              [
                "Puissance crête totale",
                `${round2((displayPanels.length * panelModel.power_w) / 1000)} kWc`,
              ],
              [
                "Production annuelle estimée",
                `${Math.round(
                  ((displayPanels.length * panelModel.power_w) / 1000) * 1650
                ).toLocaleString("fr-FR")} kWh / an`,
              ],
              [
                "Couverture de vos besoins",
                `${
                  input.annual
                    ? Math.min(
                        100,
                        Math.round(
                          ((((displayPanels.length * panelModel.power_w) / 1000) * 1650) /
                            input.annual) *
                            100
                        )
                      )
                    : 85
                }%`,
              ],
              [
                "Économie annuelle estimée",
                `${Math.round(
                  ((displayPanels.length * panelModel.power_w) / 1000) * 1650 * 0.34
                ).toLocaleString("fr-FR")} TND / an`,
              ],
              [
                "Retour sur investissement",
                `~${(
                  (Math.round(((displayPanels.length * panelModel.power_w) / 1000) * 2650) -
                    1500) /
                  Math.max(
                    1,
                    ((displayPanels.length * panelModel.power_w) / 1000) * 1650 * 0.34
                  )
                ).toFixed(1)} ans`,
              ],
            ].map(([k, v]) => (
              <View
                key={k}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 4,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255, 184, 0, 0.2)",
                }}
              >
                <Text style={{ fontSize: 12, color: colors.muted }}>{k} :</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#17212E" }}>{v}</Text>
              </View>
            ))}

            <View style={{ gap: 8, marginTop: 6 }}>
              {activeMode === "ai" ? (
                <PremiumButton
                  title="Personnaliser manuellement"
                  secondary
                  onPress={handleCustomizeAi}
                />
              ) : (
                <PremiumButton
                  title="Rétablir les recommandations IA"
                  secondary
                  onPress={handleRestoreAiProposal}
                />
              )}
              <PremiumButton
                title="Consulter l'Étude de Rentabilité"
                onPress={() => router.push("/rentabilite")}
              />
              <PremiumButton
                title="Générer le Rapport d'Ingénierie"
                secondary
                onPress={() => router.push("/rapport")}
              />
            </View>
          </GlassPanel>
        </View>
      </View>
    </ResponsiveLayout>
  );
}
