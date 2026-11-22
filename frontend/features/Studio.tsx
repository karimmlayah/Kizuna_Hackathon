import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
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
} from "lucide-react-native";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { RoofStudioCanvas } from "../components/RoofStudioCanvas";
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
  checkBackendHealth,
  type PlacedPanel,
  type RooftopAnalysisResponse,
  type AiAdviseResponse,
  type SamSegmentResponse,
  type SamPlanResponse,
} from "../services/rooftopApi";

export default function Studio() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1050;

  const {
    input,
    rooftopPhoto,
    activeMode,
    analyzing,
    analysisResult,
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

  // 3-View Layer Toggle: "original" | "masks" | "realistic"
  const [activeView, setActiveView] = useState<"original" | "masks" | "realistic">("realistic");

  // SAM AI & Placement Engine state
  const [samSegmentResult, setSamSegmentResult] = useState<SamSegmentResponse | null>(null);
  const [samPlanResult, setSamPlanResult] = useState<SamPlanResponse | null>(null);
  const [realisticRenderB64, setRealisticRenderB64] = useState<string | null>(null);
  const [samOverlayB64, setSamOverlayB64] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState<number>(0); // 0=idle, 1=load, 2=sam, 3=obstacles, 4=render/done
  const [analyzingState, setAnalyzingState] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [backendReady, setBackendReady] = useState(true);
  const [altConfigIndex, setAltConfigIndex] = useState(0);

  // AI Advice state for manual mode
  const [aiAdvice, setAiAdvice] = useState<AiAdviseResponse | null>(null);
  const [advisingState, setAdvisingState] = useState(false);

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
        // Map SAM Plan panels to PlacedPanel interface
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

      if (!analysisResult) return [];
      return altConfigIndex === 0
        ? analysisResult.primary_placement
        : analysisResult.alternative_placement;
    }
    return manualPanels;
  }, [activeMode, samPlanResult, analysisResult, altConfigIndex, manualPanels]);

  function round2(v: number): number {
    return Math.round(v * 100) / 100;
  }

  // Push to history
  const recordHistory = useCallback(
    (newPanels: PlacedPanel[]) => {
      // Run local collision detection
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
      valid: !overlapping.has(p.id) && p.x_pct >= 2 && p.y_pct >= 2 && p.x_pct + p.w_pct <= 98 && p.y_pct + p.h_pct <= 98,
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

  // Trigger SAM ViT-B Segmentation and Photorealistic Placement
  async function runSamAnalysis(photoUriToAnalyze?: string) {
    const targetUri = photoUriToAnalyze || file?.uri || rooftopPhoto;
    if (!targetUri) {
      setStatusMessage("Veuillez sélectionner ou importer une photographie de toiture.");
      return;
    }

    setAnalyzingState(true);
    setAnalysisStep(1);
    setStatusMessage("Étape 1/4 : Chargement de l'image de toiture...");

    try {
      const targetPanels = Math.max(
        4,
        Math.min(
          30,
          Math.ceil((input.annual || 2400) / 1650 / ((panelModel?.power_w || input.watts || 450) / 1000))
        )
      );

      // STEP 2: SAM Segmentation
      setAnalysisStep(2);
      setStatusMessage("Étape 2/4 : Segmentation SAM ViT-B sur GPU CUDA...");
      const segRes = await segmentRooftopSam(targetUri, targetPanels);
      setSamSegmentResult(segRes);

      if (segRes.overlay_b64) {
        setSamOverlayB64(`data:image/png;base64,${segRes.overlay_b64}`);
      }

      // STEP 3: Obstacle identification
      setAnalysisStep(3);
      setStatusMessage("Étape 3/4 : Détection automatique des obstacles & calcul zone utile...");

      // STEP 4: Calepinage & Photorealistic Rendering
      setAnalysisStep(4);
      setStatusMessage("Étape 4/4 : Placement géométrique & Génération du rendu réaliste...");

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
        const renderDataUri = `data:image/png;base64,${planRes.realistic_render_b64}`;
        setRealisticRenderB64(renderDataUri);
        setActiveView("realistic"); // Default to photorealistic view!
      }

      // Map panels for manual editing
      const [imgW, imgH] = planRes.dimensions;
      const initialPanels: PlacedPanel[] = planRes.panels.map((p) => ({
        id: p.id,
        x_pct: round2((p.x / imgW) * 100),
        y_pct: round2((p.y / imgH) * 100),
        w_pct: round2((p.w / imgW) * 100),
        h_pct: round2((p.h / imgH) * 100),
        rotation: p.rotation_deg,
        valid: p.is_valid,
        power_w: planRes.panel_wattage_w,
      }));

      set({
        activeMode: "ai",
        manualPanels: initialPanels,
        selectedPanelId: initialPanels[0]?.id || null,
      });

      setStatusMessage(`✓ Segmentation SAM et placement de ${planRes.panels_placed} panneaux réussis !`);
      setTimeout(() => setStatusMessage(""), 5000);
    } catch (err) {
      console.error(err);
      setStatusMessage(`Erreur d'analyse : ${String(err)}`);
    } finally {
      setAnalyzingState(false);
      setAnalysisStep(0);
    }
  }

  // Load sample demo roof (Villa 85 m²)
  function loadDemoRoof() {
    const sampleUri =
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAEAAQABREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    const sampleObj: LocalFile = {
      uri: sampleUri,
      name: "Villa_Moderne_Toit_85m2.jpg",
      image: true,
    };
    setFile(sampleObj);
    set({ rooftopPhoto: sampleUri });
    runSamAnalysis(sampleUri);
  }

  // Switch to Manual Mode with AI panels as baseline
  function handleCustomizeAi() {
    if (samPlanResult && samPlanResult.panels.length > 0) {
      const [imgW, imgH] = samPlanResult.dimensions;
      const basePanels = samPlanResult.panels.map((p) => ({
        id: p.id,
        x_pct: round2((p.x / imgW) * 100),
        y_pct: round2((p.y / imgH) * 100),
        w_pct: round2((p.w / imgW) * 100),
        h_pct: round2((p.h / imgH) * 100),
        rotation: p.rotation_deg,
        valid: p.is_valid,
        power_w: samPlanResult.panel_wattage_w,
      }));
      set({
        activeMode: "manual",
        manualPanels: [...basePanels],
        selectedPanelId: basePanels[0]?.id || null,
      });
      setActiveView("original");
    } else {
      set({ activeMode: "manual" });
      setActiveView("original");
    }
  }

  // Restore AI Initial Proposal
  function handleRestoreAiProposal() {
    if (samPlanResult && samPlanResult.panels.length > 0) {
      const [imgW, imgH] = samPlanResult.dimensions;
      const basePanels = samPlanResult.panels.map((p) => ({
        id: p.id,
        x_pct: round2((p.x / imgW) * 100),
        y_pct: round2((p.y / imgH) * 100),
        w_pct: round2((p.w / imgW) * 100),
        h_pct: round2((p.h / imgH) * 100),
        rotation: p.rotation_deg,
        valid: p.is_valid,
        power_w: samPlanResult.panel_wattage_w,
      }));
      recordHistory(basePanels);
    }
  }

  // Manual panel operations
  function handleAddPanel() {
    const pw_pct = 12;
    const ph_pct = 17;
    const id = `manual_${Date.now()}`;
    const newPanel: PlacedPanel = {
      id,
      x_pct: 35 + ((manualPanels.length * 4) % 40),
      y_pct: 30 + ((manualPanels.length * 5) % 35),
      w_pct: pw_pct,
      h_pct: ph_pct,
      rotation: 0,
      valid: true,
      power_w: panelModel.power_w,
    };
    recordHistory([...manualPanels, newPanel]);
    set({ selectedPanelId: id });
  }

  function handleRotateSelected() {
    if (!selectedPanelId) return;
    const updated = manualPanels.map((p) => {
      if (p.id === selectedPanelId) {
        const nextRot = p.rotation === 90 ? 0 : 90;
        return { ...p, rotation: nextRot };
      }
      return p;
    });
    recordHistory(updated);
  }

  function handleDuplicateSelected() {
    if (!selectedPanelId) return;
    const target = manualPanels.find((p) => p.id === selectedPanelId);
    if (!target) return;
    const newId = `manual_${Date.now()}`;
    const clone: PlacedPanel = {
      ...target,
      id: newId,
      x_pct: Math.min(85, target.x_pct + 4),
      y_pct: Math.min(85, target.y_pct + 4),
    };
    recordHistory([...manualPanels, clone]);
    set({ selectedPanelId: newId });
  }

  function handleDeleteSelected() {
    if (!selectedPanelId) return;
    const updated = manualPanels.filter((p) => p.id !== selectedPanelId);
    recordHistory(updated);
    set({ selectedPanelId: null });
  }

  function handleClearAll() {
    recordHistory([]);
    set({ selectedPanelId: null });
  }

  const handleSelectPanel = useCallback(
    (id: string | null) => {
      set({ selectedPanelId: id });
    },
    [set]
  );

  const handleUpdatePanel = useCallback(
    (updated: PlacedPanel) => {
      const nextList = manualPanels.map((p) => (p.id === updated.id ? updated : p));
      const validated = checkLocalCollisions(nextList);
      set({ manualPanels: validated });
    },
    [manualPanels, set]
  );

  // Dynamic metrics calculation for Manual Mode
  const manualMetrics = useMemo(() => {
    const validCount = manualPanels.filter((p) => p.valid !== false).length;
    const kwp = Math.round((validCount * (panelModel?.power_w || 450)) / 10) / 100;
    const area = Math.round(validCount * 2.0 * 10) / 10;
    const prodKwh = Math.round(kwp * 1650);
    const savingsTnd = Math.round(prodKwh * 0.34);
    const costTnd = Math.round(kwp * 2650);
    const netCost = Math.max(500, costTnd - 1500);
    const roi = savingsTnd > 0 ? Math.round((netCost / savingsTnd) * 10) / 10 : 0;
    const coverage = (input.annual || 2400) > 0
      ? Math.min(150, Math.round((prodKwh / (input.annual || 2400)) * 100))
      : 100;

    return {
      validCount,
      totalCount: manualPanels.length,
      kwp,
      area,
      prodKwh,
      savingsTnd,
      costTnd,
      netCost,
      roi,
      coverage,
    };
  }, [manualPanels, panelModel, input.annual]);

  return (
    <ResponsiveLayout>
      {/* Header & Subtitle */}
      <View style={{ gap: 10, marginBottom: 20 }}>
        <StatusIndicator label="Module 03 · Solar Design Studio (SAM ViT-B & Manuel)" />
        <Title>Studio de Conception Toiture Photovoltaïque</Title>
        <UICopy>
          Notre modèle SAM (Segment Anything) identifie automatiquement la toiture et les obstacles pour générer un calepinage photoréaliste. Prenez la main à tout moment avec les outils manuels.
        </UICopy>
      </View>

      {/* Primary Mode Switcher Pill */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#FFF9ED",
          borderRadius: 20,
          padding: 4,
          marginBottom: 20,
          maxWidth: 550,
          borderWidth: 1.5,
          borderColor: "#FFE29A",
        }}
      >
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeMode === "ai" }}
          onPress={() => set({ activeMode: "ai" })}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 10,
            borderRadius: 16,
            backgroundColor: activeMode === "ai" ? "#FFB800" : "transparent",
            gap: 8,
          }}
        >
          <Sparkles size={16} color={activeMode === "ai" ? "#17212E" : "#8A7A6A"} />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: activeMode === "ai" ? "#17212E" : "#8A7A6A",
            }}
          >
            Mode IA (SAM ViT-B Automatique)
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeMode === "manual" }}
          onPress={() => {
            set({ activeMode: "manual" });
            setActiveView("original");
          }}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 10,
            borderRadius: 16,
            backgroundColor: activeMode === "manual" ? "#FFB800" : "transparent",
            gap: 8,
          }}
        >
          <Sliders size={16} color={activeMode === "manual" ? "#17212E" : "#8A7A6A"} />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: activeMode === "manual" ? "#17212E" : "#8A7A6A",
            }}
          >
            Mode Manuel (Studio Interactif)
          </Text>
        </Pressable>
      </View>

      {/* Status / Step Progress Alert Banner */}
      {statusMessage ? (
        <View
          style={{
            backgroundColor: statusMessage.includes("Erreur") ? "#FEE2E2" : "#FFFBEB",
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1.5,
            borderColor: statusMessage.includes("Erreur") ? "#FCA5A5" : "#FDE68A",
          }}
        >
          {analyzingState ? (
            <ActivityIndicator size="small" color="#D97706" />
          ) : (
            <Info size={18} color={statusMessage.includes("Erreur") ? "#DC2626" : "#D97706"} />
          )}
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: statusMessage.includes("Erreur") ? "#991B1B" : "#92400E",
              flex: 1,
            }}
          >
            {statusMessage}
          </Text>
        </View>
      ) : null}

      {/* Main Workspace Layout */}
      <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 24, marginBottom: 32 }}>
        {/* Left Column: Canvas, 3-View Layer Toggle & Toolbars */}
        <View style={{ flex: isDesktop ? 6 : undefined, gap: 16 }}>
          {/* 3-View Layer Switcher */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {/* View Selector Buttons */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: "#FFF9ED",
                borderWidth: 1.5,
                borderColor: "#FFE29A",
                borderRadius: 14,
                padding: 3,
                gap: 4,
              }}
            >
              {[
                { id: "original", label: "Originale", icon: ImageIcon },
                { id: "masks", label: "Masques IA (SAM)", icon: Layers },
                { id: "realistic", label: "Rendu Réaliste", icon: Sparkles },
              ].map((v) => {
                const IconCmp = v.icon;
                const isSelected = activeView === v.id;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => setActiveView(v.id as any)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
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
            </View>

            {/* Quick Demo Photo Loader */}
            <Pressable
              onPress={loadDemoRoof}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 12,
                backgroundColor: "#FFF9ED",
                borderWidth: 1.5,
                borderColor: "#FFE29A",
              }}
            >
              <Wand2 size={14} color="#D97706" />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#92400E" }}>
                Toiture Démo (Villa 85 m²)
              </Text>
            </Pressable>
          </View>

          {/* Interactive Roof Canvas */}
          <RoofStudioCanvas
            photoUri={rooftopPhoto}
            mode={activeMode}
            analysis={analysisResult}
            panels={displayPanels}
            selectedId={selectedPanelId}
            showMask={showMask}
            showContours={showContours}
            activeView={activeView}
            realisticRenderUri={realisticRenderB64}
            samOverlayUri={samOverlayB64}
            onSelectPanel={handleSelectPanel}
            onUpdatePanel={handleUpdatePanel}
          />

          {/* Manual Toolbar (Visible only in Manual Mode) */}
          {activeMode === "manual" && (
            <GlassPanel style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#8A7A6A", letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Boîte à outils de calepinage manuel
                </Text>
                <Text style={{ fontSize: 11, color: "#D97706", fontWeight: "700" }}>
                  Déplacez les panneaux au doigt / souris · Collision en rouge
                </Text>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <PremiumButton title="+ Ajouter un Panneau" onPress={handleAddPanel} />
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
                  title="Effacer tout"
                  secondary
                  onPress={handleClearAll}
                />
              </View>
            </GlassPanel>
          )}

          {/* Photo Uploader Card */}
          <GlassPanel style={{ padding: 18, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#17212E" }}>
                Photographie Aérienne ou Vue Satellite
              </Text>
              {backendReady && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" }} />
                  <Text style={{ fontSize: 11, color: "#10B981", fontWeight: "700" }}>
                    SAM ViT-B (GPU CUDA) Connecté
                  </Text>
                </View>
              )}
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
                title={analyzingState ? "Segmentation SAM en cours..." : "Lancer l'Analyse SAM IA"}
                disabled={!file?.uri || analyzingState}
                onPress={() => runSamAnalysis()}
              />
              <PremiumButton
                title="Toiture Démo"
                secondary
                onPress={loadDemoRoof}
              />
            </View>
          </GlassPanel>
        </View>

        {/* Right Column: AI Recommendations & Details */}
        <View style={{ flex: isDesktop ? 4 : undefined, gap: 20 }}>
          {/* MODE 1: AI Recommendation Card */}
          {activeMode === "ai" ? (
            <GlassPanel style={{ padding: 22, gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Sparkles size={22} color="#D97706" />
                <Title>Recommandation SAM IA</Title>
              </View>

              {analyzingState ? (
                <View style={{ padding: 30, alignItems: "center", gap: 14 }}>
                  <ActivityIndicator size="large" color="#FFB800" />
                  <Text style={{ fontSize: 14, color: "#92400E", fontWeight: "700", textAlign: "center" }}>
                    {statusMessage || "Segmentation SAM ViT-B & calepinage optimisé..."}
                  </Text>
                </View>
              ) : samPlanResult ? (
                <>
                  {/* Obstacles Detected Badge */}
                  {samPlanResult.obstacle_polygons && samPlanResult.obstacle_polygons.length > 0 ? (
                    <View
                      style={{
                        backgroundColor: "#FFFBEB",
                        padding: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "#FDE68A",
                        gap: 4,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#D97706", textTransform: "uppercase" }}>
                        Zone d'exclusion et obstacles détectés
                      </Text>
                      <Text style={{ fontSize: 12, color: "#92400E" }}>
                        {samPlanResult.obstacle_polygons.length} obstacle(s) identifié(s) (cheminée, aération). Retrait de sécurité de 30 cm et buffer de 25 cm appliqués automatiquement.
                      </Text>
                    </View>
                  ) : null}

                  {/* Metrics Recap */}
                  <View style={{ gap: 8 }}>
                    {[
                      ["Panneaux placés", `${samPlanResult.panels_placed} modules photovoltaïques`],
                      ["Puissance installée", `${samPlanResult.installed_kwp} kWc`],
                      ["Puissance unitaire", `${samPlanResult.panel_wattage_w} Wc`],
                      [
                        "Production annuelle estimée",
                        `${Math.round(samPlanResult.installed_kwp * 1650).toLocaleString("fr-FR")} kWh/an`,
                      ],
                      [
                        "Économies annuelles",
                        `${Math.round(samPlanResult.installed_kwp * 1650 * 0.34).toLocaleString("fr-FR")} TND / an`,
                      ],
                      [
                        "Investissement net estimé",
                        `${Math.max(500, Math.round(samPlanResult.installed_kwp * 2650) - 1500).toLocaleString("fr-FR")} TND`,
                      ],
                      [
                        "Amortissement estimé",
                        `~${(Math.max(500, Math.round(samPlanResult.installed_kwp * 2650) - 1500) / (samPlanResult.installed_kwp * 1650 * 0.34)).toFixed(1)} ans`,
                      ],
                    ].map(([label, val]) => (
                      <View
                        key={label}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          paddingVertical: 5,
                          borderBottomWidth: 1,
                          borderColor: theme.colors.line,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#17212E" }}>
                          {val}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* 3 Core Spec Actions */}
                  <View style={{ gap: 10, marginTop: 6 }}>
                    <PremiumButton
                      title="Accepter cette implantation"
                      onPress={() => router.push("/rapport")}
                    />
                    <PremiumButton
                      title="Personnaliser manuellement"
                      secondary
                      onPress={handleCustomizeAi}
                    />
                    <PremiumButton
                      title="Voir la Rentabilité Financière"
                      secondary
                      onPress={() => router.push("/rentabilite")}
                    />
                  </View>
                </>
              ) : (
                <View style={{ padding: 20, alignItems: "center", gap: 10 }}>
                  <Text style={{ color: colors.muted, textAlign: "center", fontSize: 13 }}>
                    Importez la photo de votre toiture pour que notre IA SAM identifie votre surface et génère l'implantation optimale.
                  </Text>
                  <PremiumButton
                    title="Essayer avec Toiture Démo"
                    onPress={loadDemoRoof}
                  />
                </View>
              )}
            </GlassPanel>
          ) : (
            /* MODE 2: Manual Design Studio Panel */
            <GlassPanel style={{ padding: 22, gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Sliders size={22} color="#D97706" />
                <Title>Conception Manuelle</Title>
              </View>

              {/* Panel Library Selector */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#17212E" }}>
                  Modèle de Panneau Sélectionné :
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
                        <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? "#92400E" : "#17212E" }}>
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
              </View>

              {/* Dynamic Live Metrics */}
              <View style={{ backgroundColor: "#FFF9ED", padding: 14, borderRadius: 14, gap: 6, borderWidth: 1, borderColor: "#FFE29A" }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#92400E", letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Bilan Énergétique en Direct
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Modules valides :</Text>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#17212E" }}>
                    {manualMetrics.validCount} / {manualMetrics.totalCount} placés
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Puissance crête :</Text>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#17212E" }}>
                    {manualMetrics.kwp} kWc
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Production annuelle :</Text>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#10B981" }}>
                    {manualMetrics.prodKwh.toLocaleString("fr-FR")} kWh/an
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Taux de couverture :</Text>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#D97706" }}>
                    {manualMetrics.coverage}%
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Amortissement net :</Text>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#17212E" }}>
                    ~{manualMetrics.roi} ans
                  </Text>
                </View>
              </View>

              {/* Direct Actions */}
              <View style={{ gap: 10 }}>
                {samPlanResult && (
                  <PremiumButton
                    title="Rétablir proposition initiale de l'IA"
                    secondary
                    onPress={handleRestoreAiProposal}
                  />
                )}
                <PremiumButton
                  title="Voir la Rentabilité Financière"
                  onPress={() => router.push("/rentabilite")}
                />
                <PremiumButton
                  title="Générer le Rapport d'Installation"
                  secondary
                  onPress={() => router.push("/rapport")}
                />
                <PremiumButton
                  title="Discuter avec Solar AI"
                  secondary
                  onPress={() => router.push("/chat")}
                />
              </View>
            </GlassPanel>
          )}
        </View>
      </View>
    </ResponsiveLayout>
  );
}
