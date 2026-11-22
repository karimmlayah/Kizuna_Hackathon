import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Alert,
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
  Download,
  Grid,
  Crosshair,
  Maximize2,
  ShieldCheck,
  Compass,
  ArrowRight,
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
  selectRooftopMask,
  calibrateRooftop,
  getSmartRecommendations,
  planRooftopSolar,
  renderCustomLayout,
  validateRooftopPanels,
  checkBackendHealth,
  ensureImageBase64,
  sanitizeDataUri,
  type PlacedPanel,
  type SamSegmentResponse,
  type SamPlanResponse,
  type SamRecommendResponse,
  type ConfigProposal,
  type SamMaskInfo,
  type SamCalibrateResponse,
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
    panelModel,
    undoStack,
    redoStack,
    set,
  } = useSolarStore();

  const [file, setFile] = useState<LocalFile | null>(
    rooftopPhoto ? { uri: rooftopPhoto, name: "Toiture.jpg", image: true } : null
  );

  // 6 Dedicated Navigation Views
  const [activeView, setActiveView] = useState<StudioViewMode>("realistic");

  // SAM AI & Multi-strategy State
  const [samSegmentResult, setSamSegmentResult] = useState<SamSegmentResponse | null>(null);
  const [samPlanResult, setSamPlanResult] = useState<SamPlanResponse | null>(null);
  const [recommendations, setRecommendations] = useState<ConfigProposal[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("config_balanced");
  const [realisticRenderB64, setRealisticRenderB64] = useState<string | null>(null);
  const [samOverlayB64, setSamOverlayB64] = useState<string | null>(null);
  const [safeZoneB64, setSafeZoneB64] = useState<string | null>(null);

  // Calibration state
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibrationData, setCalibrationData] = useState<SamCalibrateResponse | null>(null);
  const [roofLengthInput, setRoofLengthInput] = useState<string>("10.5");
  const [roofWidthInput, setRoofWidthInput] = useState<string>("8.2");

  // Magnetic Grid State
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  // Analysis progress tracking
  const [analysisStep, setAnalysisStep] = useState<number>(0);
  const [analyzingState, setAnalyzingState] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [backendReady, setBackendReady] = useState(true);

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
      // Find currently selected configuration
      const activeProposal = recommendations.find((r) => r.id === selectedConfigId);
      if (activeProposal && activeProposal.panels.length > 0) {
        return activeProposal.panels.map((p) => ({
          id: p.id,
          x_pct: round1(p.corners[0] ? (p.corners[0][0] / 800) * 100 : (p.x / 800) * 100),
          y_pct: round1(p.corners[0] ? (p.corners[0][1] / 600) * 100 : (p.y / 600) * 100),
          w_pct: round1((p.w / 800) * 100),
          h_pct: round1((p.h / 600) * 100),
          rotation: p.rotation_deg,
          valid: p.is_valid,
          power_w: panelModel.power_w,
        }));
      }

      if (samPlanResult && samPlanResult.panels.length > 0) {
        const [imgW, imgH] = samPlanResult.dimensions;
        return samPlanResult.panels.map((p) => ({
          id: p.id,
          x_pct: round1((p.x / imgW) * 100),
          y_pct: round1((p.y / imgH) * 100),
          w_pct: round1((p.w / imgW) * 100),
          h_pct: round1((p.h / imgH) * 100),
          rotation: p.rotation_deg,
          valid: p.is_valid,
          power_w: samPlanResult.panel_wattage_w,
        }));
      }
    }
    return manualPanels;
  }, [activeMode, recommendations, selectedConfigId, samPlanResult, manualPanels, panelModel]);

  function round1(v: number): number {
    return Math.round(v * 10) / 10;
  }

  // Push to history with local collision check
  const recordHistory = useCallback(
    (newPanels: PlacedPanel[]) => {
      const validated = checkLocalCollisions(newPanels);
      set({
        undoStack: [[...manualPanels], ...(undoStack || []).slice(0, 19)],
        redoStack: [],
        manualPanels: validated,
      });
    },
    [manualPanels, undoStack, set]
  );

  // Local collision detection between panels
  function checkLocalCollisions(panelsList: PlacedPanel[]): PlacedPanel[] {
    const overlapping = new Set<string>();
    for (let i = 0; i < panelsList.length; i++) {
      for (let j = i + 1; j < panelsList.length; j++) {
        const p1 = panelsList[i]!;
        const p2 = panelsList[j]!;

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

    return panelsList.map((p) => {
      const isOutside = p.x_pct < 2 || p.y_pct < 2 || p.x_pct + p.w_pct > 96 || p.y_pct + p.h_pct > 96;
      const isOverlap = overlapping.has(p.id);
      return {
        ...p,
        valid: !isOutside && !isOverlap,
        warning: isOutside ? "Dépassement de la toiture" : isOverlap ? "Collision entre panneaux" : undefined,
      };
    });
  }

  // Undo / Redo actions
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

  // Main Pipeline: SAM ViT-B Segmentation + 3 Placement Strategies + HD Render
  async function runSamAnalysis(photoUriToAnalyze?: string) {
    const targetUri = photoUriToAnalyze || file?.uri || rooftopPhoto;
    if (!targetUri) {
      setStatusMessage("Veuillez sélectionner ou importer une photographie de toiture.");
      return;
    }

    setAnalyzingState(true);
    setAnalysisStep(1);
    setStatusMessage("Étape 1/4 : Chargement & vérification de l'image de toiture...");

    try {
      // STEP 2: Intelligent Roof Segmentation
      setAnalysisStep(2);
      setStatusMessage("Étape 2/4 : Détection intelligente de votre toiture et des obstacles...");
      const segRes = await segmentRooftopSam(targetUri, 6);
      setSamSegmentResult(segRes);

      if (segRes.overlay_b64) {
        setSamOverlayB64(sanitizeDataUri(segRes.overlay_b64));
      }

      // STEP 3: Multi-strategy recommendations
      setAnalysisStep(3);
      setStatusMessage("Étape 3/4 : Calcul de vos 3 propositions d'installation (Économique, Idéale, Maximale)...");

      const recRes = await getSmartRecommendations({
        imageB64: targetUri,
        roofMaskId: segRes.recommended_roof_mask_id,
        obstacleMaskIds: segRes.obstacles_detected,
        annualKwh: input.annual || 2400,
        monthlyBillTnd: input.annual ? (input.annual * 0.34) / 12 : undefined,
        panelWattageW: panelModel?.power_w || 450,
        realRoofAreaM2: calibrationData?.real_area_m2,
      });

      setRecommendations(recRes.proposals);
      setSelectedConfigId(recRes.recommended_config_id || "config_balanced");

      // STEP 4: Standard Placement & Visual Render
      setAnalysisStep(4);
      setStatusMessage("Étape 4/4 : Création du visuel de votre toiture équipée...");

      const balancedProposal = recRes.proposals.find((p) => p.is_recommended) || recRes.proposals[0];
      const targetPanels = balancedProposal ? balancedProposal.panels_count : 6;

      const planRes = await planRooftopSolar({
        imageB64: targetUri,
        roofMaskId: segRes.recommended_roof_mask_id,
        obstacleMaskIds: segRes.obstacles_detected,
        desiredPanels: targetPanels,
        panelWattageW: panelModel?.power_w || 450,
        orientation: "portrait",
        realRoofAreaM2: calibrationData?.real_area_m2,
      });

      setSamPlanResult(planRes);

      if (planRes.realistic_render_b64) {
        setRealisticRenderB64(sanitizeDataUri(planRes.realistic_render_b64));
        setActiveView("realistic");
      }

      // Map panels for manual editing
      const [imgW, imgH] = planRes.dimensions;
      const initialPanels: PlacedPanel[] = planRes.panels.map((p) => ({
        id: p.id,
        x_pct: round1((p.x / imgW) * 100),
        y_pct: round1((p.y / imgH) * 100),
        w_pct: round1((p.w / imgW) * 100),
        h_pct: round1((p.h / imgH) * 100),
        rotation: p.rotation_deg,
        valid: p.is_valid,
        power_w: planRes.panel_wattage_w,
      }));

      set({
        activeMode: "ai",
        manualPanels: initialPanels,
        selectedPanelId: initialPanels[0]?.id || null,
      });

      setStatusMessage(`✓ Analyse réussie : ${planRes.panels_placed} panneaux placés (${planRes.installed_kwp} kWc) !`);
      setTimeout(() => setStatusMessage(""), 5000);
    } catch (err) {
      console.error(err);
      setStatusMessage(`Erreur d'analyse : ${String(err)}`);
    } finally {
      setAnalyzingState(false);
      setAnalysisStep(0);
    }
  }

  // Load sample demo roof
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

  // Interactive SAM Mask Selection Handler
  async function handleSelectMask(maskId: number, asObstacle = false) {
    if (!file?.uri && !rooftopPhoto) return;
    try {
      setStatusMessage(`Mise à jour du masque toiture #${maskId}...`);
      const res = await selectRooftopMask({
        imageB64: (file?.uri || rooftopPhoto)!,
        selectedMaskId: maskId,
        asObstacle,
      });
      setSamOverlayB64(res.overlay_b64);
      setSafeZoneB64(res.safe_zone_b64);
      setStatusMessage(`✓ Masque #${maskId} sélectionné comme toiture active.`);
      setTimeout(() => setStatusMessage(""), 3500);
    } catch (e) {
      setStatusMessage(`Erreur sélection masque : ${String(e)}`);
    }
  }

  // Calibration Submit Handler
  async function handleApplyCalibration() {
    if (!file?.uri && !rooftopPhoto) return;
    try {
      const lenM = parseFloat(roofLengthInput) || 10.0;
      const widM = parseFloat(roofWidthInput) || 8.0;

      // 4 corners of roof perspective rectangle
      const points: [number, number][] = [
        [150, 120],
        [680, 140],
        [720, 520],
        [120, 480],
      ];

      setStatusMessage("Calcul de la matrice d'homographie perspective...");
      const calib = await calibrateRooftop({
        imageB64: (file?.uri || rooftopPhoto)!,
        points,
        realWidthM: widM,
        realHeightM: lenM,
      });

      setCalibrationData(calib);
      setIsCalibrating(false);
      setStatusMessage(`✓ Calibration réussie : Surface mesurée = ${calib.real_area_m2} m² (${calib.px_per_m} px/m).`);
      setTimeout(() => setStatusMessage(""), 4500);
    } catch (e) {
      setStatusMessage(`Erreur calibration : ${String(e)}`);
    }
  }

  // Apply one of the 3 strategies (Economic, Balanced, Max Capacity)
  function handleSelectProposal(proposal: ConfigProposal) {
    setSelectedConfigId(proposal.id);
    if (proposal.realistic_render_b64) {
      setRealisticRenderB64(proposal.realistic_render_b64);
    }

    const mappedPanels: PlacedPanel[] = proposal.panels.map((p) => ({
      id: p.id,
      x_pct: round1(p.corners[0] ? (p.corners[0][0] / 800) * 100 : (p.x / 800) * 100),
      y_pct: round1(p.corners[0] ? (p.corners[0][1] / 600) * 100 : (p.y / 600) * 100),
      w_pct: round1((p.w / 800) * 100),
      h_pct: round1((p.h / 600) * 100),
      rotation: p.rotation_deg,
      valid: p.is_valid,
      power_w: panelModel.power_w,
    }));

    set({ manualPanels: mappedPanels, selectedPanelId: mappedPanels[0]?.id || null });
  }

  // Manual panel operations
  function handleAddPanel() {
    const pw_pct = 12;
    const ph_pct = 17;
    const id = `manual_${Date.now()}`;
    const newPanel: PlacedPanel = {
      id,
      x_pct: 35 + ((manualPanels.length * 4) % 35),
      y_pct: 30 + ((manualPanels.length * 5) % 30),
      w_pct: pw_pct,
      h_pct: ph_pct,
      rotation: 0,
      valid: true,
      power_w: panelModel.power_w,
    };
    recordHistory([...manualPanels, newPanel]);
    set({ selectedPanelId: id });
  }

  function handleAddRowOfPanels(count = 4) {
    const pw_pct = 11;
    const ph_pct = 16;
    const startX = 25;
    const startY = 32 + (Math.floor(manualPanels.length / 4) * 18);
    const newRow: PlacedPanel[] = [];

    for (let i = 0; i < count; i++) {
      newRow.push({
        id: `row_p_${Date.now()}_${i}`,
        x_pct: startX + i * 13,
        y_pct: startY,
        w_pct: pw_pct,
        h_pct: ph_pct,
        rotation: 0,
        valid: true,
        power_w: panelModel.power_w,
      });
    }
    recordHistory([...manualPanels, ...newRow]);
  }

  function handleRotateSelected() {
    if (!selectedPanelId) return;
    const updated = manualPanels.map((p) => {
      if (p.id === selectedPanelId) {
        return { ...p, rotation: p.rotation === 90 ? 0 : 90 };
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

  function handleAlignPanels() {
    if (manualPanels.length < 2) return;
    // Align all panels to the average Y coordinate
    const avgY = Math.round(manualPanels.reduce((sum, p) => sum + p.y_pct, 0) / manualPanels.length);
    const sorted = [...manualPanels].sort((a, b) => a.x_pct - b.x_pct);
    let curX = sorted[0]!.x_pct;
    const aligned = sorted.map((p) => {
      const item = { ...p, y_pct: avgY, x_pct: curX };
      curX += (p.rotation === 90 ? p.h_pct : p.w_pct) + 2;
      return item;
    });
    recordHistory(aligned);
  }

  function handleClearAll() {
    if (Platform.OS === "web") {
      if (window.confirm("Êtes-vous certain de vouloir effacer tous les panneaux placés ?")) {
        recordHistory([]);
        set({ selectedPanelId: null });
      }
    } else {
      Alert.alert("Confirmer l'effacement", "Voulez-vous supprimer tous les panneaux ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Effacer", style: "destructive", onPress: () => recordHistory([]) },
      ]);
    }
  }

  // Trigger HD render for manual placement
  async function handleRenderManualLayout() {
    if (!file?.uri && !rooftopPhoto) return;
    try {
      setStatusMessage("Génération du rendu photoréaliste de votre disposition manuelle...");
      const res = await renderCustomLayout({
        imageB64: (file?.uri || rooftopPhoto)!,
        panels: manualPanels.map((p) => ({
          id: p.id,
          x: Math.round((p.x_pct / 100) * 800),
          y: Math.round((p.y_pct / 100) * 600),
          w: Math.round((p.w_pct / 100) * 800),
          h: Math.round((p.h_pct / 100) * 600),
          corners: [
            [Math.round((p.x_pct / 100) * 800), Math.round((p.y_pct / 100) * 600)],
            [Math.round(((p.x_pct + p.w_pct) / 100) * 800), Math.round((p.y_pct / 100) * 600)],
            [Math.round(((p.x_pct + p.w_pct) / 100) * 800), Math.round(((p.y_pct + p.h_pct) / 100) * 600)],
            [Math.round((p.x_pct / 100) * 800), Math.round(((p.y_pct + p.h_pct) / 100) * 600)],
          ],
          rotation_deg: p.rotation || 0,
          is_valid: p.valid !== false,
        })),
        roofPolygon: samPlanResult?.roof_polygon,
        obstacles: samPlanResult?.obstacle_polygons,
      });

      setRealisticRenderB64(res.realistic_render_b64);
      setActiveView("realistic");
      setStatusMessage("✓ Rendu photoréaliste HD généré avec succès !");
      setTimeout(() => setStatusMessage(""), 4000);
    } catch (e) {
      setStatusMessage(`Erreur génération rendu : ${String(e)}`);
    }
  }

  // Download rendered image in HD
  function handleDownloadRender() {
    if (!realisticRenderB64) return;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const link = document.createElement("a");
      link.href = realisticRenderB64;
      link.download = `SmartSolar_Rendu_Toiture_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Real-time technical results metrics
  const liveMetrics = useMemo(() => {
    const panelsToCount = activeMode === "ai" ? displayPanels : manualPanels;
    const validPanels = panelsToCount.filter((p) => p.valid !== false);
    const validCount = validPanels.length;
    const totalCount = panelsToCount.length;
    const kwp = Math.round((validCount * (panelModel?.power_w || 450)) / 10) / 100;
    const occupiedArea = calibrationData?.real_area_m2
      ? Math.round((validCount * (panelModel.width_m * panelModel.height_m) * 10)) / 10
      : null;
    const prodAnnualKwh = Math.round(kwp * 1650);
    const prodDailyKwh = Math.round((prodAnnualKwh / 365) * 10) / 10;
    const savingsTnd = Math.round(prodAnnualKwh * 0.34);
    const grossCostTnd = Math.round(kwp * 2650);
    const netCostTnd = Math.max(600, grossCostTnd - 1500);
    const payback = savingsTnd > 0 ? Math.round((netCostTnd / savingsTnd) * 10) / 10 : 0;
    const coverage = (input.annual || 2400) > 0
      ? Math.min(180, Math.round((prodAnnualKwh / (input.annual || 2400)) * 100))
      : 100;
    const co2Tons = Math.round(prodAnnualKwh * 0.00065 * 10) / 10;

    return {
      validCount,
      totalCount,
      kwp,
      occupiedArea,
      prodAnnualKwh,
      prodDailyKwh,
      savingsTnd,
      netCostTnd,
      payback,
      coverage,
      co2Tons,
    };
  }, [activeMode, displayPanels, manualPanels, panelModel, calibrationData, input.annual]);

  return (
    <ResponsiveLayout>
      {/* Header & Subtitle */}
      <View style={{ gap: 8, marginBottom: 18 }}>
        <StatusIndicator label="Module 03 · Conception sur Toiture & Vue 3D" />
        <Title>Studio de Conception Toiture Photovoltaïque</Title>
        <UICopy>
          Visualisez précisément vos futurs panneaux solaires sur votre propre toiture, personnalisez leur disposition et explorez votre maison en 3D.
        </UICopy>
      </View>

      {/* Mode Switcher Pill */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#FFF9ED",
          borderRadius: 18,
          padding: 4,
          marginBottom: 16,
          maxWidth: 580,
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
            paddingVertical: 9,
            borderRadius: 14,
            backgroundColor: activeMode === "ai" ? "#FFB800" : "transparent",
            gap: 7,
          }}
        >
          <Sparkles size={15} color={activeMode === "ai" ? "#17212E" : "#8A7A6A"} />
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: "800",
              color: activeMode === "ai" ? "#17212E" : "#8A7A6A",
            }}
          >
            Placement automatique (3 propositions)
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeMode === "manual" }}
          onPress={() => {
            set({ activeMode: "manual" });
            setActiveView("placement_plan");
          }}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 9,
            borderRadius: 14,
            backgroundColor: activeMode === "manual" ? "#FFB800" : "transparent",
            gap: 7,
          }}
        >
          <Sliders size={15} color={activeMode === "manual" ? "#17212E" : "#8A7A6A"} />
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: "800",
              color: activeMode === "manual" ? "#17212E" : "#8A7A6A",
            }}
          >
            Placement manuel personnalisé
          </Text>
        </Pressable>
      </View>

      {/* Status / Step Progress Alert Banner */}
      {statusMessage ? (
        <View
          style={{
            backgroundColor: statusMessage.includes("Erreur") ? "#FEE2E2" : "#FFFBEB",
            borderRadius: 14,
            padding: 12,
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
            <Info size={17} color={statusMessage.includes("Erreur") ? "#DC2626" : "#D97706"} />
          )}
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: "700",
              color: statusMessage.includes("Erreur") ? "#991B1B" : "#92400E",
              flex: 1,
            }}
          >
            {statusMessage}
          </Text>
        </View>
      ) : null}

      {/* Main Studio Workspace Grid */}
      <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 24, marginBottom: 32 }}>
        {/* Left Column: Canvas, 6 View Tabs, Toolbars */}
        <View style={{ flex: isDesktop ? 6.5 : undefined, gap: 14 }}>
          {/* Navigation Bar for All 6 Views */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
          >
            {[
              { id: "original", label: "Photo Originale", icon: ImageIcon },
              { id: "ai_analysis", label: "Surfaces Détectées", icon: Layers },
              { id: "installable_zones", label: "Zones Installables", icon: Crosshair },
              { id: "placement_plan", label: "Plan 2D", icon: Sliders },
              { id: "realistic", label: "Rendu Réaliste HD", icon: Sparkles },
              { id: "studio_3d", label: "Solar Studio 360°", icon: Sun },
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
                    borderRadius: 12,
                    backgroundColor: isSelected ? "#FFB800" : "#FFF9ED",
                    borderWidth: 1.5,
                    borderColor: isSelected ? "#FFB800" : "#FFE29A",
                  }}
                >
                  <IconCmp size={13} color={isSelected ? "#17212E" : "#8A7A6A"} />
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: "700",
                      color: isSelected ? "#17212E" : "#8A7A6A",
                    }}
                  >
                    {v.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Studio Canvas Component */}
          <RoofStudioCanvas
            photoUri={rooftopPhoto}
            mode={activeMode}
            analysis={null}
            panels={displayPanels}
            selectedId={selectedPanelId}
            showMask={true}
            showContours={true}
            activeView={activeView}
            realisticRenderUri={realisticRenderB64}
            samOverlayUri={samOverlayB64}
            safeZoneUri={safeZoneB64}
            samMasks={samSegmentResult?.masks}
            roofPolygon={samPlanResult?.roof_polygon}
            obstaclePolygons={samPlanResult?.obstacle_polygons}
            isCalibrating={isCalibrating}
            onSelectPanel={(id) => set({ selectedPanelId: id })}
            onUpdatePanel={(p) => {
              const updated = manualPanels.map((item) => (item.id === p.id ? p : item));
              recordHistory(updated);
            }}
            onSelectSamMask={handleSelectMask}
            onRequestGenerateRender={handleRenderManualLayout}
          />

          {/* Uncalibrated Warning Disclaimer Banner */}
          {!calibrationData?.calibrated && (
            <View
              style={{
                backgroundColor: "#FFFBEB",
                borderRadius: 12,
                padding: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderWidth: 1,
                borderColor: "#FDE68A",
              }}
            >
              <AlertCircle size={15} color="#D97706" />
              <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#92400E", flex: 1 }}>
                Simulation indicative — dimensions réelles à confirmer par calibration.
              </Text>
              <Pressable
                onPress={() => setIsCalibrating((c) => !c)}
                style={{
                  backgroundColor: "#FFB800",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#17212E" }}>
                  {isCalibrating ? "Fermer" : "Calibrer"}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Calibration Panel Drawer */}
          {isCalibrating && (
            <GlassPanel style={{ padding: 16, gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#17212E" }}>
                  Calibration Métrique & Homographie Perspective
                </Text>
                <Compass size={16} color="#D97706" />
              </View>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Indiquez les dimensions physiques réelles de la toiture pour calculer la surface exacte en m² et ajuster l'échelle.
              </Text>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#17212E" }}>Longueur réelle (m) :</Text>
                  <input
                    type="number"
                    value={roofLengthInput}
                    onChange={(e) => setRoofLengthInput(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #FFE29A",
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#17212E" }}>Largeur réelle (m) :</Text>
                  <input
                    type="number"
                    value={roofWidthInput}
                    onChange={(e) => setRoofWidthInput(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #FFE29A",
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <PremiumButton title="Appliquer la calibration" onPress={handleApplyCalibration} />
                <PremiumButton title="Annuler" secondary onPress={() => setIsCalibrating(false)} />
              </View>
            </GlassPanel>
          )}

          {/* Manual Toolbar (Visible in Manual Mode or Placement Plan) */}
          {activeMode === "manual" && (
            <GlassPanel style={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#8A7A6A", textTransform: "uppercase" }}>
                  Outils pour disposer vos panneaux
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Grid size={13} color="#D97706" />
                  <Text style={{ fontSize: 11, color: "#D97706", fontWeight: "700" }}>
                    Grille magnétique active
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <PremiumButton title="+ 1 Panneau" onPress={handleAddPanel} />
                <PremiumButton title="+ Rangée de 4" secondary onPress={() => handleAddRowOfPanels(4)} />
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
                <PremiumButton title="Aligner la ligne" secondary onPress={handleAlignPanels} />
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
                <PremiumButton title="Générer Rendu HD" onPress={handleRenderManualLayout} />
                <PremiumButton title="Effacer tout" secondary onPress={handleClearAll} />
              </View>
            </GlassPanel>
          )}

          {/* Photo Uploader & Sample Loader Card */}
          <GlassPanel style={{ padding: 18, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#17212E" }}>
                Photographie de Toiture ou Vue Drone
              </Text>
              {backendReady && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" }} />
                  <Text style={{ fontSize: 11, color: "#10B981", fontWeight: "700" }}>
                    Analyse intelligente prête
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
                title={analyzingState ? "Analyse de votre toiture..." : "Analyser ma toiture"}
                disabled={!file?.uri || analyzingState}
                onPress={() => runSamAnalysis()}
              />
              <PremiumButton title="Exemple de toiture (Villa 85 m²)" secondary onPress={loadDemoRoof} />
              {realisticRenderB64 && (
                <PremiumButton
                  title="Télécharger le Rendu HD"
                  secondary
                  onPress={handleDownloadRender}
                />
              )}
            </View>
          </GlassPanel>
        </View>

        {/* Right Column: AI Strategy Proposals & Real-time Technical Metrics */}
        <View style={{ flex: isDesktop ? 3.5 : undefined, gap: 18 }}>
          {/* 3 AI Recommendations / Proposals */}
          {activeMode === "ai" && (
            <GlassPanel style={{ padding: 18, gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} color="#D97706" />
                <Title>3 Stratégies d'Implantation</Title>
              </View>

              {recommendations.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {recommendations.map((p) => {
                    const isSelected = selectedConfigId === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => handleSelectProposal(p)}
                        style={{
                          padding: 12,
                          borderRadius: 14,
                          backgroundColor: isSelected ? "#FFF9ED" : "#FFFFFF",
                          borderWidth: 1.5,
                          borderColor: isSelected ? "#FFB800" : theme.colors.line,
                          gap: 6,
                        }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            {p.is_recommended && (
                              <View style={{ backgroundColor: "#10B981", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 9.5, fontWeight: "800", color: "#FFFFFF" }}>RECOMMANDÉE</Text>
                              </View>
                            )}
                            <Text style={{ fontSize: 12.5, fontWeight: "800", color: isSelected ? "#92400E" : "#17212E" }}>
                              {p.strategy_name}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: "800", color: "#D97706" }}>
                            {p.installed_kwp} kWc
                          </Text>
                        </View>

                        <Text style={{ fontSize: 11, color: colors.muted }}>{p.description}</Text>

                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                          <Text style={{ fontSize: 11, color: "#17212E", fontWeight: "700" }}>
                            {p.panels_count} panneaux ({p.orientation})
                          </Text>
                          <Text style={{ fontSize: 11, color: "#10B981", fontWeight: "700" }}>
                            {p.annual_kwh.toLocaleString("fr-FR")} kWh/an
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={{ padding: 14, alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center" }}>
                    Chargez une toiture pour obtenir 3 propositions d'implantation personnalisées.
                  </Text>
                  <PremiumButton title="Essayer la Démo" onPress={loadDemoRoof} />
                </View>
              )}
            </GlassPanel>
          )}

          {/* Panel Library Selector in Manual Mode */}
          {activeMode === "manual" && (
            <GlassPanel style={{ padding: 18, gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sliders size={18} color="#D97706" />
                <Title>Bibliothèque Panneaux</Title>
              </View>

              <View style={{ gap: 6 }}>
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
            </GlassPanel>
          )}

          {/* Dynamic Real-time Technical Metrics Card */}
          <GlassPanel style={{ padding: 18, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sun size={18} color="#FFB800" />
              <Title>Bilan Énergétique en Direct</Title>
            </View>

            <View style={{ gap: 8 }}>
              {[
                ["Modules valides", `${liveMetrics.validCount} / ${liveMetrics.totalCount} placés`],
                ["Puissance crête", `${liveMetrics.kwp} kWc`],
                [
                  "Surface occupée",
                  liveMetrics.occupiedArea ? `${liveMetrics.occupiedArea} m²` : "Non calibrée (indicative)",
                ],
                ["Production annuelle estimée", `${liveMetrics.prodAnnualKwh.toLocaleString("fr-FR")} kWh/an`],
                ["Production journalière moyenne", `${liveMetrics.prodDailyKwh} kWh/jour`],
                ["Taux de couverture solaire", `${liveMetrics.coverage}%`],
                ["Économies annuelles estimées", `${liveMetrics.savingsTnd.toLocaleString("fr-FR")} TND/an`],
                ["Coût net estimé (aides déduites)", `${liveMetrics.netCostTnd.toLocaleString("fr-FR")} TND`],
                ["Temps estimé pour rentabiliser", `~${liveMetrics.payback} ans`],
                ["CO2 évité", `${liveMetrics.co2Tons} tonnes/an`],
              ].map(([lbl, val]) => (
                <View
                  key={lbl}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 4,
                    borderBottomWidth: 1,
                    borderColor: theme.colors.line,
                  }}
                >
                  <Text style={{ fontSize: 11.5, color: colors.muted }}>{lbl}</Text>
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#17212E" }}>{val}</Text>
                </View>
              ))}
            </View>

            {/* Direct Workflow Buttons */}
            <View style={{ gap: 8, marginTop: 6 }}>
              <PremiumButton
                title="Valider & Voir le Rapport"
                onPress={() => router.push("/rapport")}
              />
              <PremiumButton
                title="Étude Financière Complète"
                secondary
                onPress={() => router.push("/rentabilite")}
              />
            </View>
          </GlassPanel>
        </View>
      </View>
    </ResponsiveLayout>
  );
}
