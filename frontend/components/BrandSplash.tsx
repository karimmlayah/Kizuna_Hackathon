import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  Platform,
  StyleSheet,
} from "react-native";
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  G,
  Circle,
  Path,
  Polygon,
  Rect,
  Line,
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Volume2, VolumeX, ChevronRight, Sun } from "lucide-react-native";
import { useMotion } from "../hooks/useMotion";
import {
  playSolarAwakening,
  playEnergyPulse,
  playCrystalLogoChime,
  stopCinematicAudio,
  setCinematicMuted,
  getCinematicMuted,
} from "../utils/cinematicAudio";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const SPLASH_KEY = "smart_solar_splash_seen_v2";

interface ParticleData {
  id: number;
  startX: number;
  startY: number;
  size: number;
  opacity: number;
  color: string;
}

export function BrandSplash({
  onDone,
  forceFull = false,
}: {
  onDone: () => void;
  forceFull?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const motion = useMotion();
  const [muted, setMutedState] = useState(getCinematicMuted());

  const cx = 350;
  const cy = 240;

  // Master timeline progress (0 -> 1)
  const masterProgress = useSharedValue(0);
  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  // Generate deterministic, aesthetic converging particles
  const particles: ParticleData[] = useMemo(() => {
    const list: ParticleData[] = [];
    const colors = ["#FFB800", "#FFD56B", "#FF9500", "#FFFDF7", "#FFE599"];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 + (i % 3) * 0.2;
      const radius = 135 + (i % 5) * 35;
      list.push({
        id: i,
        startX: cx + Math.cos(angle) * radius,
        startY: cy + Math.sin(angle) * radius,
        size: 1.8 + (i % 4) * 0.9,
        opacity: 0.5 + (i % 3) * 0.25,
        color: colors[i % colors.length] ?? "#FFB800",
      });
    }
    return list;
  }, [cx, cy]);

  const finish = useCallback(() => {
    stopCinematicAudio();
    containerOpacity.value = withTiming(0, { duration: 350 }, () => {
      onDone();
    });
    containerScale.value = withTiming(1.04, { duration: 350 });
  }, [containerOpacity, containerScale, onDone]);

  // Main Orchestration Effect
  useEffect(() => {
    let timerAwakening: any;
    let timerPulse: any;
    let timerChime: any;
    let timerFinish: any;

    async function init() {
      // Accessibility check
      if (!motion) {
        finish();
        return;
      }

      // Check if user already saw full intro
      let seen = false;
      if (!forceFull) {
        try {
          const val = await AsyncStorage.getItem(SPLASH_KEY);
          seen = val === "true";
        } catch {}
      }

      if (seen) {
        // Fast-forward launch mode (1.2s)
        playCrystalLogoChime();
        masterProgress.value = withTiming(1, {
          duration: 1100,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
        timerFinish = setTimeout(finish, 1250);
      } else {
        // Full cinematic experience (~4.5s)
        try {
          await AsyncStorage.setItem(SPLASH_KEY, "true");
        } catch {}

        // Phase 1 Audio
        playSolarAwakening();

        // Schedule sound cues
        timerPulse = setTimeout(() => {
          playEnergyPulse();
        }, 1800);

        timerChime = setTimeout(() => {
          playCrystalLogoChime();
        }, 2950);

        // Run master progress 0 -> 1 over 4400ms
        masterProgress.value = withTiming(
          1,
          {
            duration: 4400,
            easing: Easing.bezier(0.2, 0.8, 0.2, 1),
          },
          (finished) => {
            if (finished) {
              containerOpacity.value = withTiming(0, { duration: 400 }, () => {
                onDone();
              });
              containerScale.value = withTiming(1.05, { duration: 400 });
            }
          },
        );

        timerFinish = setTimeout(finish, 4800);
      }
    }

    init();

    return () => {
      clearTimeout(timerAwakening);
      clearTimeout(timerPulse);
      clearTimeout(timerChime);
      clearTimeout(timerFinish);
      stopCinematicAudio();
    };
  }, [finish, masterProgress, motion, containerOpacity, containerScale]);

  const toggleSound = () => {
    const next = !muted;
    setMutedState(next);
    setCinematicMuted(next);
  };

  // Master Animated Styles for transitions
  const rootAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  // Phase 1: Particles convergence (0.00 -> 0.28)
  const particlesLayerStyle = useAnimatedStyle(() => {
    const p = masterProgress.value;
    const opacity = interpolate(
      p,
      [0, 0.05, 0.22, 0.35],
      [0, 1, 0.8, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      p,
      [0, 0.3],
      [1.15, 0.88],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  // Phase 2: Solar Core Birth & Coronal Rings (0.12 -> 0.65)
  const solarLayerStyle = useAnimatedStyle(() => {
    const p = masterProgress.value;
    const scale = interpolate(
      p,
      [0.12, 0.26, 0.42, 0.65],
      [0.01, 1.15, 1, 0.82],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      p,
      [0.1, 0.2, 0.62, 0.72],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      p,
      [0.35, 0.65],
      [0, -45],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  // Coronal Rings expansion
  const ring1Props = useAnimatedProps(() => {
    const p = masterProgress.value;
    const r = interpolate(p, [0.18, 0.42], [28, 92], Extrapolation.CLAMP);
    const opacity = interpolate(p, [0.18, 0.28, 0.42], [0, 0.75, 0], Extrapolation.CLAMP);
    return { r, opacity };
  });

  const ring2Props = useAnimatedProps(() => {
    const p = masterProgress.value;
    const r = interpolate(p, [0.24, 0.52], [32, 130], Extrapolation.CLAMP);
    const opacity = interpolate(p, [0.24, 0.36, 0.52], [0, 0.6, 0], Extrapolation.CLAMP);
    return { r, opacity };
  });

  // Phase 3: House & Energy Flux Lines Assembly (0.38 -> 0.76)
  const houseLayerStyle = useAnimatedStyle(() => {
    const p = masterProgress.value;
    const opacity = interpolate(
      p,
      [0.38, 0.48, 0.68, 0.76],
      [0, 1, 0.95, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      p,
      [0.38, 0.52, 0.75],
      [0.85, 1, 1.05],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      p,
      [0.38, 0.55, 0.75],
      [20, 0, -10],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  // Dynamic Energy Pulse traversing PV cells
  const pvPulseProps = useAnimatedProps(() => {
    const p = masterProgress.value;
    const dashOffset = interpolate(
      p,
      [0.46, 0.64],
      [360, 0],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      p,
      [0.44, 0.5, 0.64, 0.68],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    );
    return {
      strokeDashoffset: dashOffset,
      opacity,
    };
  });

  // Phase 4: Logo Reveal & Typographic Shimmer (0.64 -> 1.0)
  const logoRevealStyle = useAnimatedStyle(() => {
    const p = masterProgress.value;
    const opacity = interpolate(
      p,
      [0.64, 0.76, 0.95],
      [0, 1, 1],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      p,
      [0.64, 0.78, 0.96],
      [0.88, 1.02, 1],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      p,
      [0.64, 0.76],
      [24, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  // Slogan tracking reveal
  const sloganStyle = useAnimatedStyle(() => {
    const p = masterProgress.value;
    const opacity = interpolate(
      p,
      [0.74, 0.86],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      p,
      [0.74, 0.86],
      [12, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <Animated.View style={[styles.container, rootAnimatedStyle]}>
      {/* Top Controls: Sound Toggle + Passer Button */}
      <View style={styles.topBar}>
        {Platform.OS === "web" && (
          <Pressable
            onPress={toggleSound}
            accessibilityRole="button"
            accessibilityLabel={muted ? "Activer le son" : "Couper le son"}
            style={styles.pillButton}
          >
            {muted ? (
              <VolumeX size={16} color="#FFE599" />
            ) : (
              <Volume2 size={16} color="#FFB800" />
            )}
          </Pressable>
        )}

        <Pressable
          onPress={finish}
          accessibilityRole="button"
          accessibilityLabel="Passer l'introduction"
          style={[styles.pillButton, styles.skipButton]}
        >
          <Text style={styles.skipText}>Passer</Text>
          <ChevronRight size={14} color="#FFE599" />
        </Pressable>
      </View>

      {/* Main SVG Composition Canvas */}
      <View style={styles.canvasContainer}>
        {/* Deep Cosmic Night Background Glow */}
        <Svg viewBox="0 0 700 480" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient
              id="bgGlow"
              cx="50%"
              cy="48%"
              r="65%"
              fx="50%"
              fy="48%"
            >
              <Stop offset="0%" stopColor="#1E2B3E" stopOpacity="0.85" />
              <Stop offset="55%" stopColor="#111925" stopOpacity="0.95" />
              <Stop offset="100%" stopColor="#0A101A" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="700" height="480" fill="url(#bgGlow)" />
        </Svg>

        {/* Layer 1: Converging Starlight & Energy Particles */}
        <Animated.View style={[StyleSheet.absoluteFill, particlesLayerStyle]}>
          <Svg viewBox="0 0 700 480" width="100%" height="100%">
            {particles.map((p) => (
              <Circle
                key={p.id}
                cx={p.startX}
                cy={p.startY}
                r={p.size}
                fill={p.color}
                opacity={p.opacity}
              />
            ))}
          </Svg>
        </Animated.View>

        {/* Layer 2: Dynamic Solar Birth, Coronal Shockwaves & Orbital Belt */}
        <Animated.View style={[StyleSheet.absoluteFill, solarLayerStyle]}>
          <Svg viewBox="0 0 700 480" width="100%" height="100%">
            <Defs>
              <RadialGradient
                id="coronaGlow"
                cx="50%"
                cy="50%"
                r="50%"
                fx="50%"
                fy="50%"
              >
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                <Stop offset="30%" stopColor="#FFE8A3" stopOpacity="0.9" />
                <Stop offset="65%" stopColor="#FFB800" stopOpacity="0.75" />
                <Stop offset="100%" stopColor="#FF9500" stopOpacity="0" />
              </RadialGradient>
            </Defs>

            {/* Outward Shockwave Rings */}
            <AnimatedCircle
              cx={cx}
              cy={cy}
              fill="none"
              stroke="#FFB800"
              strokeWidth="2.5"
              animatedProps={ring1Props}
            />
            <AnimatedCircle
              cx={cx}
              cy={cy}
              fill="none"
              stroke="#FF9500"
              strokeWidth="1.5"
              animatedProps={ring2Props}
            />

            {/* Solar Corona Halo */}
            <Circle cx={cx} cy={cy} r="65" fill="url(#coronaGlow)" />

            {/* 16 Radiating Golden Corona Rays */}
            {Array.from({ length: 16 }).map((_, i) => {
              const angle = (i * Math.PI * 2) / 16;
              const x1 = cx + Math.cos(angle) * 36;
              const y1 = cy + Math.sin(angle) * 36;
              const x2 = cx + Math.cos(angle) * (i % 2 === 0 ? 68 : 54);
              const y2 = cy + Math.sin(angle) * (i % 2 === 0 ? 68 : 54);
              return (
                <Line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#FFD56B"
                  strokeWidth={i % 2 === 0 ? 2.5 : 1.5}
                  strokeLinecap="round"
                  opacity={0.85}
                />
              );
            })}

            {/* Core Volumetric Solar Sphere */}
            <Circle cx={cx} cy={cy} r="28" fill="#FFFDF7" />
            <Circle
              cx={cx - 5}
              cy={cy - 5}
              r="22"
              fill="#FFB800"
              opacity={0.7}
            />

            {/* Orbital Particle Belt */}
            {[0, 1, 2, 3].map((i) => {
              const angle = (i * Math.PI) / 2;
              return (
                <Circle
                  key={i}
                  cx={cx + Math.cos(angle) * 44}
                  cy={cy + Math.sin(angle) * 20}
                  r="2.5"
                  fill="#FFFDF7"
                  opacity={0.9}
                />
              );
            })}
          </Svg>
        </Animated.View>

        {/* Layer 3: Energy Transformation into Architecture & Photovoltaic Grid */}
        <Animated.View style={[StyleSheet.absoluteFill, houseLayerStyle]}>
          <Svg viewBox="0 0 700 480" width="100%" height="100%">
            <Defs>
              <LinearGradient id="energyBeam" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#FFB800" stopOpacity="1" />
                <Stop offset="50%" stopColor="#FFD56B" stopOpacity="0.85" />
                <Stop offset="100%" stopColor="#38BDF8" stopOpacity="0.95" />
              </LinearGradient>
            </Defs>

            {/* Descending Golden Energy Cascade Streams */}
            <Path
              d={`M ${cx} 160 L ${cx - 60} 240 L 260 270`}
              fill="none"
              stroke="url(#energyBeam)"
              strokeWidth="2.5"
              strokeDasharray="6 4"
            />
            <Path
              d={`M ${cx} 160 L ${cx + 70} 240 L 440 280`}
              fill="none"
              stroke="url(#energyBeam)"
              strokeWidth="2.5"
              strokeDasharray="6 4"
            />

            {/* Architectural Villa Isometric Volumes */}
            <Polygon
              points="140,320 350,225 560,325 350,420"
              fill="#182433"
              stroke="#2E425B"
              strokeWidth="1.5"
            />
            <Polygon
              points="230,280 350,220 470,280 350,340"
              fill="#223246"
              stroke="#3D5676"
              strokeWidth="1.2"
            />
            <Polygon
              points="230,280 350,340 350,380 230,320"
              fill="#192534"
            />
            <Polygon
              points="350,340 470,280 470,320 350,380"
              fill="#141E2B"
            />
            <Polygon
              points="250,230 350,175 450,230 350,285"
              fill="#2D3F55"
              stroke="#4E688A"
              strokeWidth="1.2"
            />

            {/* Photovoltaic Panels Grid */}
            {Array.from({ length: 8 }, (_, i) => {
              const row = Math.floor(i / 4);
              const col = i % 4;
              const px = 270 + col * 26 + row * 18;
              const py = 224 + col * 14 - row * 10;
              return (
                <Polygon
                  key={i}
                  points={`${px},${py} ${px + 22},${py + 11} ${px + 36},${py + 4} ${px + 14},${py - 7}`}
                  fill="#0B131E"
                  stroke="#FFB800"
                  strokeWidth="1"
                />
              );
            })}

            {/* Dynamic Energy Line pulsing through the PV cells */}
            <AnimatedPath
              d="M 280 220 L 350 255 L 420 220 L 350 280 L 350 340"
              fill="none"
              stroke="#FFB800"
              strokeWidth="3.5"
              strokeDasharray="180"
              strokeLinecap="round"
              animatedProps={pvPulseProps}
            />

            {/* Illuminated Amber Windows */}
            <Polygon
              points="260,295 330,330 330,350 260,315"
              fill="#FFB800"
              opacity={0.88}
            />
            <Polygon
              points="370,330 440,295 440,315 370,350"
              fill="#FF9500"
              opacity={0.88}
            />
          </Svg>
        </Animated.View>
      </View>

      {/* PHASE 4: Premium Typographic Logo Reveal & Slogan */}
      <Animated.View style={[styles.logoContainer, logoRevealStyle]}>
        {/* Central Solar Crest Emblem */}
        <View style={styles.brandIconWrapper}>
          <View style={styles.brandIconGlow} />
          <View style={styles.brandIconBox}>
            <Sun size={38} color="#FFB800" strokeWidth={2.4} />
          </View>
        </View>

        {/* Master Typographic Wordmark */}
        <View style={styles.wordmarkRow}>
          <Text style={styles.textSmart}>smart</Text>
          <Text style={styles.textSolar}>solar</Text>
          <Text style={styles.textDegree}>°</Text>
        </View>

        {/* Slogan with Refined Tracking */}
        <Animated.View style={sloganStyle}>
          <Text style={styles.sloganText}>
            L’ÉNERGIE SOLAIRE INTELLIGENTE
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0B101A",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  topBar: {
    position: "absolute",
    top: 48,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10000,
  },
  pillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.25)",
    ...Platform.select({
      web: {
        backdropFilter: "blur(12px)",
        cursor: "pointer",
        userSelect: "none",
      },
    }),
  },
  skipButton: {
    marginLeft: "auto",
  },
  skipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFE599",
    letterSpacing: 0.5,
  },
  canvasContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    position: "absolute",
    bottom: "16%",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  brandIconWrapper: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  brandIconGlow: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255, 184, 0, 0.22)",
  },
  brandIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(21, 30, 43, 0.95)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 184, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFB800",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
  },
  textSmart: {
    fontSize: 42,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1.2,
  },
  textSolar: {
    fontSize: 42,
    fontWeight: "300",
    color: "#FFD56B",
    letterSpacing: -0.8,
  },
  textDegree: {
    fontSize: 42,
    fontWeight: "900",
    color: "#FFB800",
  },
  sloganText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFE599",
    letterSpacing: 4.5,
    textTransform: "uppercase",
    opacity: 0.92,
  },
});
