import React, { useRef, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  PanResponder,
  Platform,
  StyleSheet,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import Svg, { Polygon, Rect, Line, Circle } from "react-native-svg";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Grid,
  Sliders,
  Layers,
  RefreshCw,
} from "lucide-react-native";
import type { PlacedPanel, RooftopAnalysisResponse } from "../services/rooftopApi";
import { normalizeImageDataUri } from "../services/rooftopApi";
import { RoofStudio3D } from "./RoofStudio3D";

export type StudioViewMode =
  | "original"
  | "masks"
  | "safe_zone"
  | "plan"
  | "realistic"
  | "3d";

interface Props {
  photoUri: string | null;
  mode: "ai" | "manual";
  analysis: RooftopAnalysisResponse | null;
  panels: PlacedPanel[];
  selectedId: string | null;
  showMask: boolean;
  showContours: boolean;
  activeView?: StudioViewMode;
  realisticRenderUri?: string | null;
  samOverlayUri?: string | null;
  obstaclePolygons?: [number, number][][];
  roofPolygon?: [number, number][];
  onSelectPanel: (id: string | null) => void;
  onUpdatePanel: (panel: PlacedPanel) => void;
  onSelectMask?: (maskId: number) => void;
  onRetryAnalysis?: () => void;
}

export function RoofStudioCanvas({
  photoUri,
  mode,
  analysis,
  panels,
  selectedId,
  showMask,
  showContours,
  activeView = "plan",
  realisticRenderUri,
  samOverlayUri,
  obstaclePolygons,
  roofPolygon,
  onSelectPanel,
  onUpdatePanel,
  onSelectMask,
  onRetryAnalysis,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [magneticGrid, setMagneticGrid] = useState(true);
  const [imageError, setImageError] = useState(false);
  const sizeRef = useRef({ width: 640, height: 400 });

  // Normalization to prevent 'data:image/...;base64,data:image/...' double prefixing
  const cleanPhotoUri = useMemo(() => normalizeImageDataUri(photoUri), [photoUri]);
  const cleanRealisticUri = useMemo(
    () => normalizeImageDataUri(realisticRenderUri),
    [realisticRenderUri]
  );
  const cleanSamOverlayUri = useMemo(
    () => normalizeImageDataUri(samOverlayUri),
    [samOverlayUri]
  );

  const handleLayout = useCallback((e: any) => {
    const w = Math.round(e.nativeEvent.layout.width);
    const h = Math.round(e.nativeEvent.layout.height);
    if (w > 0 && h > 0) {
      sizeRef.current = { width: w, height: h };
    }
  }, []);

  // Pan Responder for manual dragging with optional magnetic grid
  const draggingId = useRef<string | null>(null);
  const dragStartPct = useRef({ x: 0, y: 0 });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => mode === "manual" && activeView !== "3d",
        onMoveShouldSetPanResponder: () => mode === "manual" && activeView !== "3d",
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          const { locationX, locationY } = evt.nativeEvent;
          const w = sizeRef.current.width || 640;
          const h = sizeRef.current.height || 400;
          const touchX_pct = (locationX / w) * 100;
          const touchY_pct = (locationY / h) * 100;

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
          if (!draggingId.current || mode !== "manual") return;
          const panel = panels.find((p) => p.id === draggingId.current);
          if (!panel) return;

          const w = sizeRef.current.width || 640;
          const h = sizeRef.current.height || 400;
          let dx_pct = (gesture.dx / w / zoom) * 100;
          let dy_pct = (gesture.dy / h / zoom) * 100;

          let newX = Math.max(2, Math.min(92, dragStartPct.current.x + dx_pct));
          let newY = Math.max(2, Math.min(92, dragStartPct.current.y + dy_pct));

          // Magnetic snap (to 2.5% increments)
          if (magneticGrid) {
            newX = Math.round(newX / 2.5) * 2.5;
            newY = Math.round(newY / 2.5) * 2.5;
          }

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
    [mode, activeView, panels, zoom, magneticGrid, onSelectPanel, onUpdatePanel]
  );

  // SVG Roof Polygon Points (standard 800x600 viewBox coordinate space)
  const roofSvgPoints = useMemo(() => {
    if (roofPolygon && roofPolygon.length >= 3) {
      return roofPolygon
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
        .join(" ");
    }
    if (analysis?.contours && analysis.contours.length > 0) {
      return analysis.contours[0]!
        .filter((pt) => Number.isFinite(pt.x_pct) && Number.isFinite(pt.y_pct))
        .map((pt) => `${((pt.x_pct / 100) * 800).toFixed(1)},${((pt.y_pct / 100) * 600).toFixed(1)}`)
        .join(" ");
    }
    return null;
  }, [roofPolygon, analysis]);

  // Obstacle SVG Polygons (standard 800x600 viewBox coordinate space)
  const obstacleSvgPolys = useMemo(() => {
    if (!obstaclePolygons || obstaclePolygons.length === 0) return [];
    return obstaclePolygons.map((poly) =>
      poly
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
        .join(" ")
    );
  }, [obstaclePolygons]);

  // Badge Status Title
  const badgeTitle = useMemo(() => {
    if (activeView === "realistic") {
      return cleanRealisticUri ? "Rendu Photoréaliste" : "Aperçu de Placement";
    }
    if (activeView === "3d") return "Solar Studio 3D";
    if (activeView === "masks") return "Analyse & Masques SAM";
    if (activeView === "safe_zone") return "Zones Installables";
    if (activeView === "original") return "Photo Originale";
    return mode === "ai" ? "Placement Conseillé IA" : "Édition Manuelle";
  }, [activeView, cleanRealisticUri, mode]);

  return (
    <View onLayout={handleLayout} style={styles.container}>
      {/* 3D View Tab Integration */}
      {activeView === "3d" ? (
        <RoofStudio3D panels={panels} />
      ) : (
        <>
          {/* Top Floating CAD Toolbar */}
          <View style={styles.topToolbar}>
            {/* View/Mode Badge */}
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    activeView === "realistic" && cleanRealisticUri
                      ? "#D97706"
                      : mode === "ai"
                      ? "#047857"
                      : "#FFB800",
                },
              ]}
            >
              {activeView === "realistic" && cleanRealisticUri ? (
                <Sparkles size={13} color="#FFFFFF" />
              ) : mode === "ai" ? (
                <CheckCircle2 size={13} color="#FFFFFF" />
              ) : (
                <AlertTriangle size={13} color="#17212E" />
              )}
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      mode === "manual" && activeView !== "realistic"
                        ? "#17212E"
                        : "#FFFFFF",
                  },
                ]}
              >
                {badgeTitle}
              </Text>
            </View>

            {/* Zoom & Magnetic Grid Tools */}
            <View style={styles.toolGroup}>
              <Pressable
                onPress={() => setMagneticGrid((g) => !g)}
                accessibilityLabel="Grille magnétique"
                style={[styles.iconButton, magneticGrid && styles.iconButtonActive]}
              >
                <Grid size={15} color={magneticGrid ? "#FFB800" : "#94A3B8"} />
              </Pressable>
              <Pressable
                onPress={() => setZoom((z) => Math.min(2.5, z + 0.25))}
                accessibilityLabel="Zoom avant"
                style={styles.iconButton}
              >
                <ZoomIn size={15} color="#FFB800" />
              </Pressable>
              <Pressable
                onPress={() => setZoom((z) => Math.max(0.75, z - 0.25))}
                accessibilityLabel="Zoom arrière"
                style={styles.iconButton}
              >
                <ZoomOut size={15} color="#FFB800" />
              </Pressable>
              <Pressable
                onPress={() => setZoom(1)}
                accessibilityLabel="Réinitialiser la vue"
                style={styles.iconButton}
              >
                <RotateCcw size={15} color="#FFE599" />
              </Pressable>
            </View>
          </View>

          {/* Canvas Viewport */}
          <View
            {...panResponder.panHandlers}
            style={[
              styles.viewport,
              {
                transform: [{ scale: zoom }],
              },
            ]}
          >
            {/* Error Fallback Card if photo fails */}
            {imageError ? (
              <View style={styles.errorBox}>
                <AlertTriangle size={32} color="#EF4444" />
                <Text style={styles.errorText}>
                  Impossible de charger l'image de toiture.
                </Text>
                {onRetryAnalysis && (
                  <Pressable onPress={onRetryAnalysis} style={styles.retryButton}>
                    <RefreshCw size={14} color="#FFFFFF" />
                    <Text style={styles.retryButtonText}>Réessayer l'analyse</Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            {/* LAYER 1: Base Rooftop Photo */}
            {cleanPhotoUri && !imageError ? (
              <Image
                source={{ uri: cleanPhotoUri }}
                onError={() => setImageError(true)}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : !cleanPhotoUri && !imageError ? (
              /* Architectural blueprint background if no photo */
              <View style={styles.blueprintBg}>
                <Svg width="100%" height="100%">
                  {Array.from({ length: 12 }).map((_, r) => (
                    <Line
                      key={`h-${r}`}
                      x1="0"
                      y1={r * 40}
                      x2="1000"
                      y2={r * 40}
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeWidth="1"
                    />
                  ))}
                  {Array.from({ length: 18 }).map((_, c) => (
                    <Line
                      key={`v-${c}`}
                      x1={c * 40}
                      y1="0"
                      x2={c * 40}
                      y2="600"
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeWidth="1"
                    />
                  ))}
                </Svg>
                <Text style={styles.blueprintHint}>
                  Importez une photo pour calibrer et poser vos panneaux
                </Text>
              </View>
            ) : null}

            {/* LAYER 2: SAM Masks & Safe Zones */}
            {(activeView === "masks" || showMask) && cleanSamOverlayUri ? (
              <Image
                source={{ uri: cleanSamOverlayUri }}
                style={[StyleSheet.absoluteFill, { opacity: 0.65 }]}
                resizeMode="cover"
              />
            ) : null}

            {/* LAYER 3: Installable Safe Zone & Obstacles Polygons */}
            {(activeView === "safe_zone" || showContours) && (
              <Svg
                viewBox="0 0 800 600"
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              >
                {/* Roof Contour (Green) */}
                {roofSvgPoints && (
                  <Polygon
                    points={roofSvgPoints}
                    fill="rgba(16, 185, 129, 0.16)"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeDasharray="6 3"
                  />
                )}
                {/* Obstacle Exclusions (Red) */}
                {obstacleSvgPolys.map((pts, i) => (
                  <Polygon
                    key={`obs-${i}`}
                    points={pts}
                    fill="rgba(239, 68, 68, 0.40)"
                    stroke="#EF4444"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                ))}
              </Svg>
            )}

            {/* LAYER 4: Photovoltaic Panels CAD Layout (Shown in 'plan', 'safe_zone', 'masks') */}
            {activeView !== "realistic" &&
              panels.map((p) => {
                const isSelected = p.id === selectedId;
                const isInvalid = p.valid === false;
                const isRotated = p.rotation === 90;

                const renderW = isRotated ? p.h_pct : p.w_pct;
                const renderH = isRotated ? p.w_pct : p.h_pct;

                return (
                  <Pressable
                    key={p.id}
                    onPress={() => onSelectPanel(p.id)}
                    style={[
                      styles.panelBox,
                      {
                        left: `${p.x_pct}%`,
                        top: `${p.y_pct}%`,
                        width: `${renderW}%`,
                        height: `${renderH}%`,
                        borderColor: isInvalid
                          ? "#EF4444"
                          : isSelected
                          ? "#FFB800"
                          : "#38BDF8",
                        borderWidth: isSelected ? 2.5 : isInvalid ? 2 : 1.2,
                        backgroundColor: isInvalid
                          ? "rgba(239, 68, 68, 0.65)"
                          : isSelected
                          ? "rgba(8, 16, 26, 0.95)"
                          : "rgba(13, 24, 38, 0.88)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.panelIdText,
                        { color: isInvalid ? "#FCA5A5" : isSelected ? "#FFB800" : "#94A3B8" },
                      ]}
                    >
                      {p.id.replace("p_", "P")}
                    </Text>
                  </Pressable>
                );
              })}

            {/* LAYER 5: Photorealistic Render with Before/After Comparison Slider */}
            {activeView === "realistic" && cleanRealisticUri && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { overflow: "hidden", pointerEvents: "none" },
                ]}
              >
                <Image
                  source={{ uri: cleanRealisticUri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              </View>
            )}
          </View>

          {/* Interactive Legend Bar */}
          <View style={styles.legendBar}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
              <Text style={styles.legendText}>Surface Exploitable</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
              <Text style={styles.legendText}>Obstacle / Exclu</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#38BDF8" }]} />
              <Text style={styles.legendText}>Panneaux 450W</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#FFB800" }]} />
              <Text style={styles.legendText}>Sélectionné</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: "100%",
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#0D1826",
    borderWidth: 1.5,
    borderColor: "#FFE29A",
  },
  topToolbar: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    zIndex: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    pointerEvents: "box-none",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  toolGroup: {
    flexDirection: "row",
    backgroundColor: "rgba(23, 33, 46, 0.88)",
    borderRadius: 14,
    padding: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.3)",
    ...Platform.select({
      web: { backdropFilter: "blur(8px)" },
    }),
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  iconButtonActive: {
    backgroundColor: "rgba(255, 184, 0, 0.25)",
    borderWidth: 1,
    borderColor: "#FFB800",
  },
  viewport: {
    width: "100%",
    aspectRatio: 1.6,
    maxHeight: 520,
    minHeight: 340,
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FCA5A5",
    textAlign: "center",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#D97706",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  blueprintBg: {
    width: "100%",
    height: "100%",
    backgroundColor: "#162334",
    alignItems: "center",
    justifyContent: "center",
  },
  blueprintHint: {
    position: "absolute",
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255, 229, 153, 0.7)",
    textAlign: "center",
  },
  panelBox: {
    position: "absolute",
    minWidth: 26,
    minHeight: 34,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  panelIdText: {
    fontSize: 10,
    fontWeight: "800",
  },
  legendBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#0B111A",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 226, 154, 0.15)",
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
