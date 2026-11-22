import React, { useMemo, useState, useEffect } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import Svg, { Polygon, Rect, Line, Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { Sun, Play, RotateCcw, Compass } from "lucide-react-native";
import type { PlacedPanel } from "../services/rooftopApi";

interface Props {
  panels: PlacedPanel[];
  hour?: number;
  onHourChange?: (hour: number) => void;
  calibratedAreaM2?: number;
}

export function RoofStudio3D({
  panels,
  hour: externalHour = 14,
  onHourChange,
  calibratedAreaM2,
}: Props) {
  const [internalHour, setInternalHour] = useState(externalHour);
  const [animatingMount, setAnimatingMount] = useState(false);
  const [mountStep, setMountStep] = useState(4); // 0=none, 1=rails, 2=panels, 3=inverter, 4=done

  const currentHour = onHourChange ? externalHour : internalHour;

  const handleHourSelect = (h: number) => {
    setInternalHour(h);
    onHourChange?.(h);
  };

  const startMountAnimation = () => {
    setAnimatingMount(true);
    setMountStep(0);
    setTimeout(() => setMountStep(1), 500); // rails
    setTimeout(() => setMountStep(2), 1200); // panels
    setTimeout(() => setMountStep(3), 2000); // inverter
    setTimeout(() => {
      setMountStep(4);
      setAnimatingMount(false);
    }, 2800);
  };

  // Sun astronomical angle approximation based on hour (6h -> 19h)
  const sunProgress = (currentHour - 6) / 13; // 0 (sunrise) -> 0.5 (zenith 12h30) -> 1 (sunset)
  const sunAngle = sunProgress * Math.PI;
  const sunElevation = Math.sin(sunAngle); // 0 at dawn, 1 at noon
  const sunAzimuth = Math.cos(sunAngle); // 1 East -> -1 West

  // Sun position on SVG sky dome
  const sunX = 350 - sunAzimuth * 220;
  const sunY = 70 + (1 - sunElevation) * 110;

  // Dynamic shadow offset
  const shadowDx = sunAzimuth * 24;
  const shadowDy = Math.max(8, (1 - sunElevation) * 35);
  const shadowOpacity = Math.max(0.15, Math.min(0.55, sunElevation * 0.7));

  return (
    <View style={styles.container}>
      {/* 3D Sun Controls Header */}
      <View style={styles.controlsBar}>
        <View style={styles.sunTimeBadge}>
          <Sun size={14} color="#FFB800" />
          <Text style={styles.sunTimeText}>{Math.floor(currentHour)}h00</Text>
          <Text style={styles.sunStatusText}>
            {currentHour < 9
              ? "Matinée (Ombres longues Est)"
              : currentHour <= 15
              ? "Zénith (Ensoleillement max)"
              : "Après-midi (Ombres Ouest)"}
          </Text>
        </View>

        <Pressable
          onPress={startMountAnimation}
          disabled={animatingMount}
          style={[styles.animButton, animatingMount && { opacity: 0.6 }]}
        >
          <Play size={13} color="#FFFFFF" />
          <Text style={styles.animButtonText}>
            {animatingMount ? "Montage en cours..." : "Voir mon installation 3D"}
          </Text>
        </Pressable>
      </View>

      {/* Hour Slider Controls */}
      <View style={styles.hourSliderRow}>
        {[8, 10, 12, 14, 16, 18].map((h) => (
          <Pressable
            key={h}
            onPress={() => handleHourSelect(h)}
            style={[
              styles.hourPill,
              Math.abs(currentHour - h) < 1 && styles.hourPillActive,
            ]}
          >
            <Text
              style={[
                styles.hourPillText,
                Math.abs(currentHour - h) < 1 && styles.hourPillTextActive,
              ]}
            >
              {h}h
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 3D Isometric SVG Scene */}
      <View style={styles.canvasWrapper}>
        <Svg viewBox="0 0 700 440" width="100%" height="100%">
          <Defs>
            <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFDF7" stopOpacity="1" />
              <Stop offset="40%" stopColor="#FFE29A" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#FF9500" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Dynamic Sun Orb in the Sky */}
          <Circle cx={sunX} cy={sunY} r="32" fill="url(#sunGlow)" />
          <Circle cx={sunX} cy={sunY} r="14" fill="#FFFDF7" />

          {/* Ground & Yard Foundation */}
          <Polygon
            points="60,280 350,150 640,290 350,420"
            fill="#1E2A3A"
          />

          {/* Main House Isometric Base */}
          <Polygon
            points="180,240 350,165 520,245 350,320"
            fill="#27384D"
          />
          <Polygon
            points="180,240 350,320 350,370 180,290"
            fill="#1B2635"
          />
          <Polygon
            points="350,320 520,245 520,295 350,370"
            fill="#16202D"
          />

          {/* Pitched / Flat Roof Surface (Where panels reside) */}
          <Polygon
            points="200,195 350,130 500,200 350,265"
            fill="#2C3E54"
            stroke="#4A6488"
            strokeWidth="1.5"
          />

          {/* Dynamic Cast Shadows of Chimney/Obstacle */}
          <Polygon
            points={`240,185 ${240 + shadowDx},${185 + shadowDy} ${260 + shadowDx},${185 + shadowDy} 260,185`}
            fill="#0A1018"
            opacity={shadowOpacity}
          />

          {/* Chimney Obstacle in 3D */}
          <Polygon points="240,165 255,155 270,165 255,175" fill="#475569" />
          <Polygon points="240,165 255,175 255,195 240,185" fill="#334155" />
          <Polygon points="255,175 270,165 270,185 255,195" fill="#1E293B" />

          {/* Step 1: Aluminum Mounting Rails */}
          {mountStep >= 1 && (
            <Line
              x1="240"
              y1="195"
              x2="460"
              y2="200"
              stroke="#94A3B8"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          )}
          {mountStep >= 1 && (
            <Line
              x1="260"
              y1="225"
              x2="440"
              y2="230"
              stroke="#94A3B8"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          )}

          {/* Step 2: 3D Photovoltaic Modules */}
          {mountStep >= 2 &&
            panels.map((p, idx) => {
              // Project 2D panel percentage coordinates into isometric roof plane
              const rawX = Number.isFinite(p.x_pct) ? p.x_pct : 30;
              const rawY = Number.isFinite(p.y_pct) ? p.y_pct : 30;
              const rawW = Number.isFinite(p.w_pct) ? p.w_pct : 12;
              const rawH = Number.isFinite(p.h_pct) ? p.h_pct : 18;

              const u = Math.max(0, Math.min(1, rawX / 100));
              const v = Math.max(0, Math.min(1, rawY / 100));

              // Roof quad interpolation: Top=(350,135), Left=(220,195), Right=(480,200), Bot=(350,260)
              const topX = 350, topY = 135;
              const leftX = 220, leftY = 195;
              const rightX = 480, rightY = 200;
              const botX = 350, botY = 260;

              const px = topX + (rightX - topX) * u + (leftX - topX) * v;
              const py = topY + (rightY - topY) * u + (botY - topY) * v;

              const pw = Math.max(16, (rawW / 100) * 160);
              const ph = Math.max(12, (rawH / 100) * 110);

              const sDx = Number.isFinite(shadowDx) ? shadowDx : 0;
              const sDy = Number.isFinite(shadowDy) ? shadowDy : 10;
              const pShadowX = px + sDx * 0.4;
              const pShadowY = py + sDy * 0.4;

              return (
                <React.Fragment key={p.id || idx}>
                  {/* Module soft drop shadow */}
                  <Polygon
                    points={`${pShadowX.toFixed(1)},${pShadowY.toFixed(1)} ${(pShadowX + pw).toFixed(1)},${(pShadowY + 6).toFixed(1)} ${(pShadowX + pw - 6).toFixed(1)},${(pShadowY + ph).toFixed(1)} ${(pShadowX - 6).toFixed(1)},${(pShadowY + ph - 6).toFixed(1)}`}
                    fill="#080F18"
                    opacity={shadowOpacity * 0.8}
                  />

                  {/* Monocrystalline module face */}
                  <Polygon
                    points={`${px.toFixed(1)},${py.toFixed(1)} ${(px + pw).toFixed(1)},${(py + 6).toFixed(1)} ${(px + pw - 6).toFixed(1)},${(py + ph).toFixed(1)} ${(px - 6).toFixed(1)},${(py + ph - 6).toFixed(1)}`}
                    fill="#0B131E"
                    stroke={p.valid === false ? "#EF4444" : "#38BDF8"}
                    strokeWidth="1.2"
                  />

                  {/* Cell grid line */}
                  <Line
                    x1={px + pw / 2}
                    y1={py + 3}
                    x2={px + pw / 2 - 3}
                    y2={py + ph - 3}
                    stroke="#1E3A5F"
                    strokeWidth="0.8"
                  />
                </React.Fragment>
              );
            })}

          {/* Step 3: Inverter Node & Energy Flow */}
          {mountStep >= 3 && (
            <>
              {/* Inverter Box on wall */}
              <Rect
                x="340"
                y="330"
                width="22"
                height="32"
                rx="4"
                fill="#FFFFFF"
                stroke="#FFB800"
                strokeWidth="1.5"
              />
              {/* Conduit to roof */}
              <Line
                x1="351"
                y1="330"
                x2="351"
                y2="265"
                stroke="#FFB800"
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />
            </>
          )}

          {/* Illuminated Amber Windows */}
          <Polygon points="215,260 295,300 295,320 215,280" fill="#FFB800" opacity="0.9" />
          <Polygon points="370,300 480,250 480,270 370,320" fill="#FF9500" opacity="0.9" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#0B111A",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 184, 0, 0.3)",
    padding: 14,
    gap: 12,
  },
  controlsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  sunTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 184, 0, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.35)",
  },
  sunTimeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFB800",
  },
  sunStatusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFE599",
  },
  animButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#D97706",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
  },
  animButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  hourSliderRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  hourPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  hourPillActive: {
    backgroundColor: "#FFB800",
    borderColor: "#FFB800",
  },
  hourPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
  },
  hourPillTextActive: {
    color: "#17212E",
  },
  canvasWrapper: {
    width: "100%",
    height: 340,
    backgroundColor: "#080F18",
    borderRadius: 16,
    overflow: "hidden",
  },
});
