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
} from "react-native";
import Svg, { Polygon, Rect, Line, Circle } from "react-native-svg";
import { ZoomIn, ZoomOut, RotateCcw, AlertTriangle, CheckCircle2, Sparkles, Layers } from "lucide-react-native";
import type { PlacedPanel, RooftopAnalysisResponse } from "../services/rooftopApi";

interface Props {
  photoUri: string | null;
  mode: "ai" | "manual";
  analysis: RooftopAnalysisResponse | null;
  panels: PlacedPanel[];
  selectedId: string | null;
  showMask: boolean;
  showContours: boolean;
  activeView?: "original" | "masks" | "realistic";
  realisticRenderUri?: string | null;
  samOverlayUri?: string | null;
  obstaclePolygons?: [number, number][][];
  onSelectPanel: (id: string | null) => void;
  onUpdatePanel: (panel: PlacedPanel) => void;
}

export function RoofStudioCanvas({
  photoUri,
  mode,
  analysis,
  panels,
  selectedId,
  showMask,
  showContours,
  activeView = "original",
  realisticRenderUri,
  samOverlayUri,
  obstaclePolygons,
  onSelectPanel,
  onUpdatePanel,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 420 });
  const sizeRef = useRef({ width: 600, height: 420 });

  // Memoize layout handler with a safe threshold to prevent infinite render loops in React Native Web
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

  // Memoize image sources to maintain referential equality across renders
  const photoSource = useMemo(() => (photoUri ? { uri: photoUri } : null), [photoUri]);
  const realisticSource = useMemo(
    () => (realisticRenderUri ? { uri: realisticRenderUri } : null),
    [realisticRenderUri]
  );
  const samOverlaySource = useMemo(
    () => (samOverlayUri ? { uri: samOverlayUri } : null),
    [samOverlayUri]
  );

  // Pan Responder for moving individual panels in manual mode
  const draggingId = useRef<string | null>(null);
  const dragStartPct = useRef({ x: 0, y: 0 });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => mode === "manual",
        onMoveShouldSetPanResponder: () => mode === "manual",
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
          if (!draggingId.current || mode !== "manual") return;
          const panel = panels.find((p) => p.id === draggingId.current);
          if (!panel) return;

          const dx_pct = (gesture.dx / canvasSize.width / zoom) * 100;
          const dy_pct = (gesture.dy / canvasSize.height / zoom) * 100;

          const newX = Math.max(2, Math.min(92, dragStartPct.current.x + dx_pct));
          const newY = Math.max(2, Math.min(92, dragStartPct.current.y + dy_pct));

          onUpdatePanel({
            ...panel,
            x_pct: round2(newX),
            y_pct: round2(newY),
          });
        },
        onPanResponderRelease: () => {
          draggingId.current = null;
        },
      }),
    [mode, panels, canvasSize.width, canvasSize.height, zoom, onSelectPanel, onUpdatePanel]
  );

  function round2(v: number): number {
    return Math.round(v * 100) / 100;
  }

  // Pre-calculate SVG contour points
  const contourSvgPolys = useMemo(() => {
    if (!analysis?.contours) return [];
    return analysis.contours.map((contour) =>
      contour
        .map(
          (pt) =>
            `${(pt.x_pct / 100) * canvasSize.width},${(pt.y_pct / 100) * canvasSize.height}`
        )
        .join(" ")
    );
  }, [analysis, canvasSize.width, canvasSize.height]);

  // Pre-calculate obstacle SVG points
  const obstacleSvgPolys = useMemo(() => {
    if (!obstaclePolygons || obstaclePolygons.length === 0) return [];
    return obstaclePolygons.map((poly) =>
      poly
        .map(
          ([x, y]) =>
            `${((x / 1024) * canvasSize.width).toFixed(1)},${((y / 768) * canvasSize.height).toFixed(1)}`
        )
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
        backgroundColor: "#0D1826",
        borderWidth: 1.5,
        borderColor: "#FFE29A",
      }}
    >
      {/* Zoom / Reset Toolbar */}
      <View
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          zIndex: 30,
          flexDirection: "row",
          backgroundColor: "rgba(23, 33, 46, 0.85)",
          borderRadius: 14,
          padding: 4,
          gap: 6,
          borderWidth: 1,
          borderColor: "rgba(255, 184, 0, 0.3)",
        }}
      >
        <Pressable
          onPress={() => setZoom((z) => Math.min(2.2, z + 0.2))}
          style={{ padding: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" }}
        >
          <ZoomIn size={16} color="#FFB800" />
        </Pressable>
        <Pressable
          onPress={() => setZoom((z) => Math.max(0.8, z - 0.2))}
          style={{ padding: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" }}
        >
          <ZoomOut size={16} color="#FFB800" />
        </Pressable>
        <Pressable
          onPress={() => setZoom(1)}
          style={{ padding: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" }}
        >
          <RotateCcw size={16} color="#FFE29A" />
        </Pressable>
      </View>

      {/* Mode Badge */}
      <View
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 30,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: mode === "ai" ? "#047857" : "#FFB800",
          borderRadius: 12,
          paddingHorizontal: 10,
          paddingVertical: 5,
          gap: 6,
        }}
      >
        {mode === "ai" ? (
          <CheckCircle2 size={13} color="#FFFFFF" />
        ) : (
          <AlertTriangle size={13} color="#17212E" />
        )}
        <Text
          style={{
            fontSize: 11,
            fontWeight: "800",
            color: mode === "ai" ? "#FFFFFF" : "#17212E",
          }}
        >
          {activeView === "realistic"
            ? "Rendu Photoréaliste"
            : mode === "ai"
            ? "Recommandation IA (SAM ViT-B)"
            : "Édition Manuelle"}
        </Text>
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
        {/* VIEW 3: Photorealistic Photovoltaic Render */}
        {activeView === "realistic" && realisticSource ? (
          Platform.OS === "web" ? (
            <img
              src={realisticRenderUri || undefined}
              alt="Rendu photoréaliste toiture"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                userSelect: "none",
              }}
            />
          ) : (
            <Image
              source={realisticSource}
              style={{ width: "100%", height: "100%", resizeMode: "cover" }}
            />
          )
        ) : (
          /* VIEW 1 & 2: Background Rooftop Photo */
          <>
            {photoSource ? (
              Platform.OS === "web" ? (
                <img
                  src={photoUri || undefined}
                  alt="Photo toiture"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    userSelect: "none",
                  }}
                />
              ) : (
                <Image
                  source={photoSource}
                  style={{ width: "100%", height: "100%", resizeMode: "cover" }}
                />
              )
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#223247",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
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
                  {Array.from({ length: 20 }).map((_, c) => (
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
              </View>
            )}

            {/* SAM Overlay Mask in VIEW 2 (Masques IA) */}
            {(activeView === "masks" || showMask) && samOverlaySource ? (
              Platform.OS === "web" ? (
                <img
                  src={samOverlayUri || undefined}
                  alt="Masque SAM"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0.65,
                    pointerEvents: "none",
                    objectFit: "cover",
                    userSelect: "none",
                  }}
                />
              ) : (
                <Image
                  source={samOverlaySource}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0.65,
                  }}
                />
              )
            ) : null}

            {/* Obstacles Polygons Highlight */}
            {activeView === "masks" && obstacleSvgPolys.length > 0 ? (
              <Svg
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                }}
              >
                {obstacleSvgPolys.map((pts, i) => (
                  <Polygon
                    key={`obs-${i}`}
                    points={pts}
                    fill="rgba(239, 68, 68, 0.35)"
                    stroke="#EF4444"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                ))}
              </Svg>
            ) : null}

            {/* Roof Contours SVG Overlay */}
            {showContours && contourSvgPolys.length > 0 ? (
              <Svg
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                }}
              >
                {contourSvgPolys.map((pts, i) => (
                  <Polygon
                    key={i}
                    points={pts}
                    fill="rgba(16, 185, 129, 0.12)"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeDasharray="6 3"
                  />
                ))}
              </Svg>
            ) : null}

            {/* Photovoltaic Panels Layer */}
            {panels.map((p, index) => {
              const isSelected = p.id === selectedId;
              const isInvalid = p.valid === false;
              const isRotated = p.rotation === 90;

              const renderW = isRotated ? p.h_pct : p.w_pct;
              const renderH = isRotated ? p.w_pct : p.h_pct;

              return (
                <Pressable
                  key={p.id}
                  onPress={() => onSelectPanel(p.id)}
                  style={{
                    position: "absolute",
                    left: `${p.x_pct}%`,
                    top: `${p.y_pct}%`,
                    width: `${renderW}%`,
                    height: `${renderH}%`,
                    minWidth: 26,
                    minHeight: 34,
                    backgroundColor: isInvalid
                      ? "rgba(239, 68, 68, 0.55)"
                      : isSelected
                      ? "#08101A"
                      : "#0D1826",
                    borderRadius: 4,
                    borderWidth: isSelected ? 2.5 : isInvalid ? 2.5 : 1,
                    borderColor: isSelected
                      ? "#FFB800"
                      : isInvalid
                      ? "#EF4444"
                      : "rgba(56, 189, 248, 0.5)",
                    shadowColor: isSelected ? "#FFB800" : isInvalid ? "#EF4444" : "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isSelected ? 0.7 : 0.3,
                    shadowRadius: isSelected ? 8 : 3,
                    elevation: isSelected ? 6 : 2,
                    justifyContent: "space-between",
                    padding: 2,
                    overflow: "hidden",
                  }}
                >
                  {/* Photovoltaic cell grid lines */}
                  <View style={{ flex: 1, justifyContent: "space-evenly" }}>
                    <View
                      style={{
                        height: 1,
                        backgroundColor: isInvalid ? "rgba(255,255,255,0.4)" : "rgba(56, 189, 248, 0.35)",
                        width: "100%",
                      }}
                    />
                    <View
                      style={{
                        height: 1,
                        backgroundColor: isInvalid ? "rgba(255,255,255,0.4)" : "rgba(56, 189, 248, 0.35)",
                        width: "100%",
                      }}
                    />
                  </View>

                  {/* Panel Number Badge */}
                  <View
                    style={{
                      position: "absolute",
                      top: 2,
                      left: 2,
                      backgroundColor: isSelected
                        ? "#FFB800"
                        : isInvalid
                        ? "#EF4444"
                        : "rgba(0,0,0,0.65)",
                      borderRadius: 3,
                      paddingHorizontal: 3,
                      paddingVertical: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: "800",
                        color: isSelected ? "#17212E" : "#FFFFFF",
                      }}
                    >
                      #{index + 1}
                    </Text>
                  </View>

                  {/* Busbar reflection line */}
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: "50%",
                      width: 1,
                      backgroundColor: "rgba(255, 255, 255, 0.3)",
                    }}
                  />
                </Pressable>
              );
            })}
          </>
        )}
      </View>
    </View>
  );
}
