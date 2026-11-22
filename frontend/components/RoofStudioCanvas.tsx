import React, { useRef, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  PanResponder,
  useWindowDimensions,
  Platform,
  type GestureResponderEvent,
  type PanResponderGestureState,
  StyleSheet,
} from "react-native";
import Svg, { Polygon, Rect, Line, Circle, G } from "react-native-svg";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Layers,
  Sliders,
  Eye,
  Camera,
  RefreshCw,
  Crosshair,
  ShieldAlert,
  HelpCircle,
} from "lucide-react-native";
import type { PlacedPanel, RooftopAnalysisResponse, SamMaskInfo } from "../services/rooftopApi";
import { sanitizeDataUri } from "../services/rooftopApi";
import { SolarStudio3D } from "./SolarStudio3D";

export type StudioViewMode =
  | "original"
  | "ai_analysis"
  | "installable_zones"
  | "placement_plan"
  | "realistic"
  | "studio_3d";

interface Props {
  photoUri: string | null;
  mode: "ai" | "manual";
  analysis: RooftopAnalysisResponse | null;
  panels: PlacedPanel[];
  selectedId: string | null;
  showMask: boolean;
  showContours: boolean;
  activeView: StudioViewMode;
  realisticRenderUri?: string | null;
  samOverlayUri?: string | null;
  safeZoneUri?: string | null;
  samMasks?: SamMaskInfo[];
  roofPolygon?: [number, number][];
  obstaclePolygons?: [number, number][][];
  isCalibrating?: boolean;
  calibrationPoints?: [number, number][];
  onCalibrationPointChange?: (index: number, pt: [number, number]) => void;
  onSelectPanel: (id: string | null) => void;
  onUpdatePanel: (panel: PlacedPanel) => void;
  onSelectSamMask?: (maskId: number, asObstacle?: boolean) => void;
  onRequestGenerateRender?: () => void;
}

export function RoofStudioCanvas({
  photoUri,
  mode,
  analysis,
  panels,
  selectedId,
  showMask,
  showContours,
  activeView,
  realisticRenderUri,
  samOverlayUri,
  safeZoneUri,
  samMasks,
  roofPolygon,
  obstaclePolygons,
  isCalibrating = false,
  calibrationPoints,
  onCalibrationPointChange,
  onSelectPanel,
  onUpdatePanel,
  onSelectSamMask,
  onRequestGenerateRender,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 620, height: 430 });
  const sizeRef = useRef({ width: 620, height: 430 });

  // Before / After slider state in "realistic" view (0 = original photo, 100 = full photorealistic render)
  const [beforeAfterSplit, setBeforeAfterSplit] = useState<number>(100);

  // Image load state tracking
  const [isRenderLoaded, setIsRenderLoaded] = useState<boolean>(false);
  const [isRenderError, setIsRenderError] = useState<boolean>(false);

  // Layer visibility toggles in Legend
  const [layerRoofVisible, setLayerRoofVisible] = useState(true);
  const [layerSafeZoneVisible, setLayerSafeZoneVisible] = useState(true);
  const [layerObstaclesVisible, setLayerObstaclesVisible] = useState(true);
  const [layerPanelsVisible, setLayerPanelsVisible] = useState(true);

  // Memoize layout handler with threshold
  const handleLayout = useCallback((e: any) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (!w || w <= 0) return;
    const aspectHeight = Math.max(340, Math.min(540, Math.round(w * 0.62)));
    if (
      Math.abs(sizeRef.current.width - w) < 16 &&
      Math.abs(sizeRef.current.height - aspectHeight) < 16
    ) {
      return;
    }
    sizeRef.current = { width: w, height: aspectHeight };
    setCanvasSize({ width: w, height: aspectHeight });
  }, []);

  // Sanitize image URIs to prevent any double-prefixing or invalid format
  const sanitizedPhotoUri = useMemo(() => sanitizeDataUri(photoUri), [photoUri]);
  const sanitizedRealisticUri = useMemo(
    () => sanitizeDataUri(realisticRenderUri),
    [realisticRenderUri]
  );
  const sanitizedOverlayUri = useMemo(() => sanitizeDataUri(samOverlayUri), [samOverlayUri]);
  const sanitizedSafeZoneUri = useMemo(() => sanitizeDataUri(safeZoneUri), [safeZoneUri]);

  // Reset load state when realistic URI changes
  React.useEffect(() => {
    if (sanitizedRealisticUri) {
      setIsRenderLoaded(false);
      setIsRenderError(false);
    }
  }, [sanitizedRealisticUri]);

  // Pan Responder for moving individual panels in manual mode
  const draggingId = useRef<string | null>(null);
  const dragStartPct = useRef({ x: 0, y: 0 });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => activeView === "placement_plan" || mode === "manual",
        onMoveShouldSetPanResponder: () => activeView === "placement_plan" || mode === "manual",
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          const { locationX, locationY } = evt.nativeEvent;
          const touchX_pct = (locationX / canvasSize.width) * 100;
          const touchY_pct = (locationY / canvasSize.height) * 100;

          const hit = [...panels].reverse().find((p) => {
            const pw = p.rotation === 90 ? p.h_pct : p.w_pct;
            const ph = p.rotation === 90 ? p.w_pct : p.h_pct;
            return (
              touchX_pct >= p.x_pct &&
              touchX_pct <= p.x_pct + pw &&
              touchY_pct >= p.y_pct &&
              touchY_pct <= p.y_pct + ph
            );
          });

          if (hit) {
            draggingId.current = hit.id;
            dragStartPct.current = { x: hit.x_pct, y: hit.y_pct };
            onSelectPanel(hit.id);
          } else {
            draggingId.current = null;
            onSelectPanel(null);
          }
        },
        onPanResponderMove: (_: GestureResponderEvent, gesture: PanResponderGestureState) => {
          if (!draggingId.current) return;
          const panel = panels.find((p) => p.id === draggingId.current);
          if (!panel) return;

          const dx_pct = (gesture.dx / canvasSize.width / zoom) * 100;
          const dy_pct = (gesture.dy / canvasSize.height / zoom) * 100;

          const newX = Math.max(2, Math.min(94, dragStartPct.current.x + dx_pct));
          const newY = Math.max(2, Math.min(94, dragStartPct.current.y + dy_pct));

          onUpdatePanel({
            ...panel,
            x_pct: Math.round(newX * 10) / 10,
            y_pct: Math.round(newY * 10) / 10,
          });
        },
        onPanResponderRelease: () => {
          draggingId.current = null;
        },
      }),
    [activeView, mode, panels, canvasSize.width, canvasSize.height, zoom, onSelectPanel, onUpdatePanel]
  );

  // SVG Roof Polygon Points
  const roofSvgPoints = useMemo(() => {
    if (!roofPolygon || roofPolygon.length < 3) return "";
    return roofPolygon
      .map(([x, y]) => `${((x / 1024) * canvasSize.width).toFixed(1)},${((y / 768) * canvasSize.height).toFixed(1)}`)
      .join(" ");
  }, [roofPolygon, canvasSize.width, canvasSize.height]);

  // SVG Obstacle Polygons Points
  const obstacleSvgPoints = useMemo(() => {
    if (!obstaclePolygons || obstaclePolygons.length === 0) return [];
    return obstaclePolygons.map((poly) =>
      poly
        .map(([x, y]) => `${((x / 1024) * canvasSize.width).toFixed(1)},${((y / 768) * canvasSize.height).toFixed(1)}`)
        .join(" ")
    );
  }, [obstaclePolygons, canvasSize.width, canvasSize.height]);

  return (
    <View
      onLayout={handleLayout}
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 22,
        overflow: "hidden",
        backgroundColor: "#0B1422",
        borderWidth: 1.5,
        borderColor: "#FFE29A",
      }}
    >
      {/* 3D View Render Option */}
      {activeView === "studio_3d" ? (
        <SolarStudio3D
          panels={panels}
          roofPolygon={roofPolygon}
          tiltAngleDeg={20}
          selectedPanelId={selectedId}
          onPanelSelect={(id) => onSelectPanel(id)}
        />
      ) : (
        <>
          {/* Zoom / Reset Floating Toolbar */}
          <View style={styles.zoomToolbar}>
            <Pressable
              onPress={() => setZoom((z) => Math.min(2.5, z + 0.2))}
              style={styles.toolBtn}
              accessibilityLabel="Zoom avant"
            >
              <ZoomIn size={15} color="#FFB800" />
            </Pressable>
            <Pressable
              onPress={() => setZoom((z) => Math.max(0.7, z - 0.2))}
              style={styles.toolBtn}
              accessibilityLabel="Zoom arrière"
            >
              <ZoomOut size={15} color="#FFB800" />
            </Pressable>
            <Pressable
              onPress={() => setZoom(1)}
              style={styles.toolBtn}
              accessibilityLabel="Réinitialiser zoom"
            >
              <RotateCcw size={15} color="#FFE29A" />
            </Pressable>
          </View>

          {/* Mode & View Status Badge (Top-Left) */}
          <View style={styles.modeBadge}>
            {activeView === "realistic" ? (
              isRenderLoaded ? (
                <>
                  <CheckCircle2 size={13} color="#10B981" />
                  <Text style={[styles.badgeText, { color: "#10B981" }]}>
                    Rendu Photoréaliste Actif
                  </Text>
                </>
              ) : (
                <>
                  <AlertTriangle size={13} color="#FFB800" />
                  <Text style={[styles.badgeText, { color: "#FFB800" }]}>
                    Rendu en attente
                  </Text>
                </>
              )
            ) : activeView === "ai_analysis" ? (
              <>
                <Sparkles size={13} color="#38BDF8" />
                <Text style={[styles.badgeText, { color: "#38BDF8" }]}>
                  Analyse de votre toiture
                </Text>
              </>
            ) : activeView === "installable_zones" ? (
              <>
                <Crosshair size={13} color="#10B981" />
                <Text style={[styles.badgeText, { color: "#10B981" }]}>
                  Zones Installables Nettes
                </Text>
              </>
            ) : (
              <>
                <Sliders size={13} color="#FFEAA7" />
                <Text style={[styles.badgeText, { color: "#FFEAA7" }]}>
                  Disposition des panneaux
                </Text>
              </>
            )}
          </View>

          {/* Canvas Viewport */}
          <View
            {...panResponder.panHandlers}
            style={{
              width: "100%",
              height: canvasSize.height,
              position: "relative",
              transform: [{ scale: zoom }],
            }}
          >
            {/* 1. VIEW: REALISTIC RENDER (WITH BEFORE/AFTER COMPARISON) */}
            {activeView === "realistic" ? (
              sanitizedRealisticUri && !isRenderError ? (
                <View style={{ width: "100%", height: "100%", position: "relative" }}>
                  {/* Underneath: Original Rooftop Photo */}
                  {sanitizedPhotoUri && (
                    <img
                      src={sanitizedPhotoUri}
                      alt="Toiture originale"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                  )}

                  {/* Overlaid: Realistic Photovoltaic Render with split clip */}
                  <img
                    src={sanitizedRealisticUri}
                    alt="Rendu photoréaliste toiture"
                    onLoad={() => setIsRenderLoaded(true)}
                    onError={() => setIsRenderError(true)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      display: "block",
                      clipPath: `inset(0 ${100 - beforeAfterSplit}% 0 0)`,
                      transition: "clip-path 0.1s ease-out",
                    }}
                  />

                  {/* Split Line Indicator if comparison is active */}
                  {beforeAfterSplit < 99 && beforeAfterSplit > 1 && (
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${beforeAfterSplit}%`,
                        width: 2,
                        backgroundColor: "#FFB800",
                        zIndex: 25,
                      }}
                    />
                  )}
                </View>
              ) : (
                /* Empty state / Error state for Photorealistic view */
                <View style={styles.emptyContainer}>
                  <Sparkles size={38} color="#FFB800" style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyTitle}>Rendu Visuel Non Disponible</Text>
                  <Text style={styles.emptySubtitle}>
                    {isRenderError
                      ? "L'image du rendu n'a pas pu être chargée ou décodée."
                      : "Lancez l'analyse automatique ou disposez vos panneaux pour visualiser votre toiture équipée."}
                  </Text>
                  {onRequestGenerateRender && (
                    <Pressable
                      style={styles.retryBtn}
                      onPress={onRequestGenerateRender}
                    >
                      <RefreshCw size={14} color="#17212E" />
                      <Text style={styles.retryBtnText}>Afficher mon installation</Text>
                    </Pressable>
                  )}
                </View>
              )
            ) : (
              /* 2. VIEWS: ORIGINAL, AI ANALYSIS, INSTALLABLE ZONES, PLACEMENT PLAN */
              <View style={{ width: "100%", height: "100%", position: "relative" }}>
                {/* Background Photo */}
                {sanitizedPhotoUri ? (
                  <img
                    src={sanitizedPhotoUri}
                    alt="Photo toiture"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      display: "block",
                      userSelect: "none",
                    }}
                  />
                ) : (
                  <View style={styles.emptyContainer}>
                    <Camera size={38} color="#64748B" style={{ marginBottom: 10 }} />
                    <Text style={styles.emptyTitle}>Aucune photo de toiture sélectionnée</Text>
                    <Text style={styles.emptySubtitle}>
                      Importez une photo aérienne ou chargez la toiture de démonstration ci-dessous.
                    </Text>
                  </View>
                )}

                {/* Layer 2: Surfaces de toiture détectées (View: ai_analysis) */}
                {activeView === "ai_analysis" && sanitizedOverlayUri && (
                  <img
                    src={sanitizedOverlayUri}
                    alt="Surfaces de toiture détectées"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      opacity: 0.65,
                      pointerEvents: "none",
                    }}
                  />
                )}

                {/* Layer 3: Installable Safe Zone (View: installable_zones) */}
                {activeView === "installable_zones" && sanitizedSafeZoneUri && (
                  <img
                    src={sanitizedSafeZoneUri}
                    alt="Zone installable nette"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      opacity: 0.70,
                      pointerEvents: "none",
                    }}
                  />
                )}

                {/* Vector SVG Overlays (Contours, Obstacles, Calibration) */}
                <Svg
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: isCalibrating ? "auto" : "none",
                  }}
                >
                  {/* Roof Polygon Contour */}
                  {layerRoofVisible && roofSvgPoints && (
                    <Polygon
                      points={roofSvgPoints}
                      fill="rgba(0, 184, 255, 0.12)"
                      stroke="#FFB800"
                      strokeWidth="2.5"
                      strokeDasharray="6 3"
                    />
                  )}

                  {/* Obstacles Detected */}
                  {layerObstaclesVisible &&
                    obstacleSvgPoints.map((pts, idx) => (
                      <Polygon
                        key={`obs-${idx}`}
                        points={pts}
                        fill="rgba(239, 68, 68, 0.40)"
                        stroke="#EF4444"
                        strokeWidth="2"
                      />
                    ))}

                  {/* Calibration 4 Points Quad */}
                  {isCalibrating && calibrationPoints && calibrationPoints.length === 4 && (
                    <G>
                      <Polygon
                        points={calibrationPoints
                          .map(([x, y]) => `${(x / 100) * canvasSize.width},${(y / 100) * canvasSize.height}`)
                          .join(" ")}
                        fill="rgba(255, 184, 0, 0.18)"
                        stroke="#FFB800"
                        strokeWidth="2"
                      />
                      {calibrationPoints.map(([x, y], i) => (
                        <Circle
                          key={`calib-${i}`}
                          cx={(x / 100) * canvasSize.width}
                          cy={(y / 100) * canvasSize.height}
                          r={8}
                          fill="#FFB800"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                      ))}
                    </G>
                  )}
                </Svg>

                {/* Layer 4: Interactive Photovoltaic Panels (View: placement_plan) */}
                {(activeView === "placement_plan" || mode === "manual") &&
                  layerPanelsVisible &&
                  panels.map((p, index) => {
                    const isSelected = p.id === selectedId;
                    const isValid = p.valid !== false;
                    const pw = p.rotation === 90 ? p.h_pct : p.w_pct;
                    const ph = p.rotation === 90 ? p.w_pct : p.h_pct;

                    return (
                      <View
                        key={p.id}
                        style={{
                          position: "absolute",
                          left: `${p.x_pct}%`,
                          top: `${p.y_pct}%`,
                          width: `${pw}%`,
                          height: `${ph}%`,
                          backgroundColor: isSelected
                            ? "rgba(255, 184, 0, 0.35)"
                            : isValid
                            ? "rgba(16, 185, 129, 0.25)"
                            : "rgba(239, 68, 68, 0.45)",
                          borderWidth: isSelected ? 2.5 : 1.5,
                          borderColor: isSelected
                            ? "#FFB800"
                            : isValid
                            ? "#10B981"
                            : "#EF4444",
                          borderRadius: 3,
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: isSelected
                            ? "0 0 12px rgba(255, 184, 0, 0.6)"
                            : "0 2px 6px rgba(0,0,0,0.4)",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "800",
                            color: "#FFFFFF",
                            textShadowColor: "rgba(0,0,0,0.8)",
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 2,
                          }}
                        >
                          #{index + 1}
                        </Text>
                      </View>
                    );
                  })}
              </View>
            )}
          </View>

          {/* Interactive Floating Legend (Bottom Left) */}
          <View style={styles.legendCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Pressable
                onPress={() => setLayerRoofVisible((v) => !v)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <View style={[styles.legendDot, { backgroundColor: "#FFB800" }]} />
                <Text style={styles.legendText}>Toiture</Text>
              </Pressable>

              <Pressable
                onPress={() => setLayerSafeZoneVisible((v) => !v)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
                <Text style={styles.legendText}>Zone Installable</Text>
              </Pressable>

              <Pressable
                onPress={() => setLayerObstaclesVisible((v) => !v)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
                <Text style={styles.legendText}>Obstacles (Cheminée, etc.)</Text>
              </Pressable>

              <Pressable
                onPress={() => setLayerPanelsVisible((v) => !v)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <View style={[styles.legendDot, { backgroundColor: "#38BDF8" }]} />
                <Text style={styles.legendText}>Panneaux ({panels.length})</Text>
              </Pressable>
            </View>

            {/* Before / After Slider (When in realistic view) */}
            {activeView === "realistic" && isRenderLoaded && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#94A3B8" }}>Avant</Text>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={beforeAfterSplit}
                  onChange={(e) => setBeforeAfterSplit(parseInt(e.target.value, 10))}
                  style={{ flex: 1, accentColor: "#FFB800", cursor: "pointer" }}
                />
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFB800" }}>Après (Solaire)</Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  zoomToolbar: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 40,
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    backdropFilter: "blur(10px)" as any,
    borderRadius: 14,
    padding: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.3)",
  },
  toolBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  modeBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    zIndex: 40,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    backdropFilter: "blur(10px)" as any,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.25)",
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  emptyContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#131C28",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFDF7",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    maxWidth: 420,
    lineHeight: 18,
    marginBottom: 16,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFB800",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    shadowColor: "#FFB800",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 },
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#17212E",
  },
  legendCard: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 40,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    backdropFilter: "blur(10px)" as any,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.25)",
    padding: 10,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#CBD5E1",
  },
});
