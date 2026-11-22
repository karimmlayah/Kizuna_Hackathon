import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  StyleSheet,
  Platform,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Circle,
  Path,
  Rect,
  G,
  Polygon,
  Line,
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import { useMotion } from "../hooks/useMotion";
import { theme } from "../theme";

interface BrandSplashProps {
  onDone: () => void;
  fastLaunch?: boolean;
}

// 18 micro-particules solaires générées avec des positions déterministes
const PARTICLES = Array.from({ length: 18 }).map((_, i) => {
  const angle = (i / 18) * Math.PI * 2 + (i % 3) * 0.2;
  const dist = 90 + (i % 5) * 28;
  return {
    id: i,
    initX: Math.cos(angle) * dist,
    initY: Math.sin(angle) * dist,
    size: 2 + (i % 4) * 1.2,
    color: i % 3 === 0 ? "#FFB800" : i % 3 === 1 ? "#FFD166" : "#38BDF8",
    delay: (i * 0.035) % 0.4,
  };
});

// 12 rayons solaires progressifs
const RAYS = Array.from({ length: 12 }).map((_, i) => {
  const deg = i * 30;
  return {
    deg,
    length: i % 2 === 0 ? 32 : 22,
    width: i % 2 === 0 ? 3 : 2,
  };
});

// 6 panneaux photovoltaïques sur le toit de la villa
const PANELS = [
  { id: 0, x: 135, y: 226, w: 18, h: 10 },
  { id: 1, x: 157, y: 226, w: 18, h: 10 },
  { id: 2, x: 179, y: 226, w: 18, h: 10 },
  { id: 3, x: 203, y: 226, w: 18, h: 10 },
  { id: 4, x: 225, y: 226, w: 18, h: 10 },
  { id: 5, x: 247, y: 226, w: 18, h: 10 },
];

export function BrandSplash({ onDone, fastLaunch = false }: BrandSplashProps) {
  const { width, height } = useWindowDimensions();
  const motion = useMotion();

  // Contrôle d'animation Reanimated unifié (0.0 -> 1.0)
  const masterProgress = useSharedValue(0);
  const ring1Rotation = useSharedValue(0);
  const ring2Rotation = useSharedValue(0);
  const shimmerPosition = useSharedValue(0);
  const solarPulse = useSharedValue(1);
  const exitOpacity = useSharedValue(1);

  // État local de complétion pour éviter multi-déclenchement
  const [isFinishing, setIsFinishing] = useState(false);

  // Synthétiseur audio Web Audio API (doux, non-bloquant, fail-safe)
  const audioCtxRef = useRef<any>(null);

  const playHarmonicSound = useCallback((frequency: number, duration: number, gainVal = 0.03) => {
    try {
      if (typeof window === "undefined") return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(gainVal, ctx.currentTime + duration * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Les navigateurs bloquent parfois l'audio sans geste utilisateur, silence fail-safe
    }
  }, []);

  const triggerCompletion = useCallback(() => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem("smart_solar_splash_seen", "true");
      }
    } catch {}
    onDone();
  }, [onDone]);

  const handleSkip = useCallback(() => {
    if (isFinishing) return;
    setIsFinishing(true);
    exitOpacity.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) }, () => {
      runOnJS(triggerCompletion)();
    });
  }, [exitOpacity, isFinishing, triggerCompletion]);

  // Durée totale calculée selon les préférences utilisateur
  const totalDuration = useMemo(() => {
    if (!motion) return 300;
    if (fastLaunch) return 1200;
    try {
      if (typeof window !== "undefined" && window.sessionStorage?.getItem("smart_solar_splash_seen")) {
        return 2200; // Accélération subtile lors des visites suivantes de la même session
      }
    } catch {}
    return 4400; // 4.4 secondes pour la chorégraphie cinématographique complète
  }, [motion, fastLaunch]);

  useEffect(() => {
    if (!motion) {
      masterProgress.value = 1;
      const t = setTimeout(triggerCompletion, 200);
      return () => clearTimeout(t);
    }

    // Rotation continue des anneaux d'énergie orbitaux
    ring1Rotation.value = withRepeat(
      withTiming(360, { duration: 5000, easing: Easing.linear }),
      -1,
      false
    );
    ring2Rotation.value = withRepeat(
      withTiming(-360, { duration: 6500, easing: Easing.linear }),
      -1,
      false
    );

    // Respiration organique du cœur solaire
    solarPulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.96, { duration: 1100, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Balayage spéculaire sur le logo
    shimmerPosition.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
      -1,
      false
    );

    // Éveil sonore harmonique
    playHarmonicSound(196.0, 1.2, 0.025); // Sol doux (G3)
    const tSoundEnergy = setTimeout(() => playHarmonicSound(329.63, 0.8, 0.03), totalDuration * 0.45); // Mi (E4)
    const tSoundLogo = setTimeout(() => playHarmonicSound(493.88, 1.0, 0.035), totalDuration * 0.65); // Si (B4)

    // Progression principale de l'animation
    masterProgress.value = withTiming(
      1,
      {
        duration: totalDuration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
      },
      (finished) => {
        if (finished) {
          exitOpacity.value = withTiming(
            0,
            { duration: 420, easing: Easing.inOut(Easing.quad) },
            () => {
              runOnJS(triggerCompletion)();
            }
          );
        }
      }
    );

    return () => {
      clearTimeout(tSoundEnergy);
      clearTimeout(tSoundLogo);
    };
  }, [
    masterProgress,
    exitOpacity,
    ring1Rotation,
    ring2Rotation,
    solarPulse,
    shimmerPosition,
    motion,
    totalDuration,
    triggerCompletion,
    playHarmonicSound,
  ]);

  // STYLES ANIMÉS REANIMATED

  // 1. Conteneur global avec zoom fluide en fin de transition
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      masterProgress.value,
      [0, 0.85, 1],
      [1, 1, 1.06],
      Extrapolation.CLAMP
    );
    return {
      opacity: exitOpacity.value,
      transform: [{ scale }],
    };
  });

  // 2. Halo solaire volumétrique d'arrière-plan
  const ambientHaloStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      masterProgress.value,
      [0, 0.15, 0.5, 0.85, 1],
      [0.4, 0.8, 1.1, 1.25, 1.8],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      masterProgress.value,
      [0, 0.2, 0.7, 0.9, 1],
      [0.1, 0.45, 0.6, 0.7, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  // 3. Groupe Solaire (Cœur, rayons, anneaux)
  const sunGroupStyle = useAnimatedStyle(() => {
    // Phase 1 -> 2 : apparition et expansion du soleil
    const scale = interpolate(
      masterProgress.value,
      [0, 0.15, 0.35, 0.65, 0.85],
      [0.2, 0.85, 1.0, 0.95, 0.9],
      Extrapolation.CLAMP
    ) * solarPulse.value;

    const translateY = interpolate(
      masterProgress.value,
      [0, 0.25, 0.6, 0.85],
      [0, 0, -20, -50],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      masterProgress.value,
      [0, 0.08, 0.9, 1],
      [0, 1, 1, 0.85],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  // 4. Rayons solaires progressifs
  const raysStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      masterProgress.value,
      [0.15, 0.35, 0.8],
      [0.1, 1, 1.05],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      masterProgress.value,
      [0.15, 0.3, 0.9],
      [0, 0.9, 0.9],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  // 5. Anneau orbital 1 (Or Solaire)
  const ring1Style = useAnimatedStyle(() => ({
    transform: [
      { rotateZ: `${ring1Rotation.value}deg` },
      { scaleX: 1.15 },
      { scaleY: 0.55 },
    ],
  }));

  // 6. Anneau orbital 2 (Bleu Cyan Solaire)
  const ring2Style = useAnimatedStyle(() => ({
    transform: [
      { rotateZ: `${ring2Rotation.value}deg` },
      { scaleX: 0.65 },
      { scaleY: 1.2 },
    ],
  }));

  // 7. Faisceau d'énergie photonique vers la villa (Phase 3 : 0.35 -> 0.65)
  const energyBeamStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      masterProgress.value,
      [0.35, 0.45, 0.62, 0.72],
      [0, 1, 0.95, 0],
      Extrapolation.CLAMP
    );
    const scaleY = interpolate(
      masterProgress.value,
      [0.35, 0.48],
      [0.1, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ scaleY }],
    };
  });

  // 8. Villa contemporaine méditerranéenne & Panneaux solaires (Phase 3 : 0.40 -> 0.75)
  const villaStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      masterProgress.value,
      [0.38, 0.48, 0.72, 0.82],
      [0, 1, 1, 0.15],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      masterProgress.value,
      [0.38, 0.48],
      [15, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  // 9. Révélation du Logo et typographie cinétique (Phase 4 : 0.65 -> 1.0)
  const logoTextStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      masterProgress.value,
      [0.62, 0.74],
      [0, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      masterProgress.value,
      [0.62, 0.74],
      [24, 0],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      masterProgress.value,
      [0.62, 0.78],
      [0.92, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  // 10. Balayage spéculaire (shimmer) sur le texte
  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerPosition.value,
      [0, 1],
      [-180, 240],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }],
    };
  });

  // 11. Slogans et badges
  const taglineStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      masterProgress.value,
      [0.72, 0.84],
      [0, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      masterProgress.value,
      [0.72, 0.84],
      [12, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <Animated.View style={[styles.rootContainer, containerAnimatedStyle]}>
      {/* 0. Halo d'ambiance volumétrique profond */}
      <Animated.View style={[styles.ambientGlowContainer, ambientHaloStyle]}>
        <Svg width={460} height={460} viewBox="0 0 460 460">
          <Defs>
            <RadialGradient id="ambientGrad" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#FFB800" stopOpacity="0.45" />
              <Stop offset="35%" stopColor="#FF8A00" stopOpacity="0.22" />
              <Stop offset="65%" stopColor="#38BDF8" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#0B1422" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="230" cy="230" r="230" fill="url(#ambientGrad)" />
        </Svg>
      </Animated.View>

      {/* Bouton Passer discret et accessible */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkip}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Passer l'introduction"
      >
        <Text style={styles.skipText}>Passer ✕</Text>
      </TouchableOpacity>

      {/* Composition Scénographique Centrale */}
      <View style={styles.stage}>
        {/* SVG Principal : Dimensions proportionnées 400x420 */}
        <Svg width={380} height={400} viewBox="0 0 380 400" style={styles.svgLayer}>
          <Defs>
            {/* Gradients Solaires */}
            <RadialGradient id="sunCoreGrad" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#FFFDF7" stopOpacity="1" />
              <Stop offset="30%" stopColor="#FFE066" stopOpacity="1" />
              <Stop offset="70%" stopColor="#FFB800" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FF7A00" stopOpacity="0.9" />
            </RadialGradient>

            <LinearGradient id="beamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFB800" stopOpacity="0.85" />
              <Stop offset="40%" stopColor="#FFD166" stopOpacity="0.75" />
              <Stop offset="80%" stopColor="#38BDF8" stopOpacity="0.65" />
              <Stop offset="100%" stopColor="#FFEAA7" stopOpacity="0.1" />
            </LinearGradient>

            <LinearGradient id="rayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFE29A" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#FFB800" stopOpacity="0" />
            </LinearGradient>

            <LinearGradient id="goldWireGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#FFB800" stopOpacity="0.9" />
              <Stop offset="50%" stopColor="#FFFDF7" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FF8A00" stopOpacity="0.9" />
            </LinearGradient>

            <LinearGradient id="windowGlowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFEAA7" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#FFB800" stopOpacity="0.5" />
            </LinearGradient>
          </Defs>

          {/* Micro-particules d'éveil convergent (Phase 1) */}
          <G>
            {PARTICLES.map((p) => (
              <Circle
                key={p.id}
                cx={190 + p.initX}
                cy={150 + p.initY}
                r={p.size}
                fill={p.color}
                opacity={0.65}
              />
            ))}
          </G>
        </Svg>

        {/* 1. Groupe Solaire Vectoriel & Rayons (Phase 2) */}
        <Animated.View style={[styles.sunContainer, sunGroupStyle]}>
          {/* Rayons solaires géométriques */}
          <Animated.View style={[styles.raysAbsolute, raysStyle]}>
            <Svg width={200} height={200} viewBox="0 0 200 200">
              <Defs>
                <LinearGradient id="rayLinear" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#FFEAA7" stopOpacity="0.85" />
                  <Stop offset="100%" stopColor="#FFB800" stopOpacity="0.05" />
                </LinearGradient>
              </Defs>
              <G transform="translate(100, 100)">
                {RAYS.map((r, i) => (
                  <Line
                    key={i}
                    x1="0"
                    y1={-(42 + r.length)}
                    x2="0"
                    y2="-42"
                    stroke="url(#rayLinear)"
                    strokeWidth={r.width}
                    strokeLinecap="round"
                    transform={`rotate(${r.deg})`}
                  />
                ))}
              </G>
            </Svg>
          </Animated.View>

          {/* Anneau orbital 1 : Or Solaire */}
          <Animated.View style={[styles.ringContainer, ring1Style]}>
            <Svg width={180} height={180} viewBox="0 0 180 180">
              <Circle
                cx="90"
                cy="90"
                r="72"
                stroke="#FFB800"
                strokeWidth="1.8"
                strokeDasharray="9 6"
                fill="none"
                opacity={0.7}
              />
              {/* Photon en orbite */}
              <Circle cx="162" cy="90" r="4" fill="#FFFDF7" opacity={0.95} />
            </Svg>
          </Animated.View>

          {/* Anneau orbital 2 : Cyan Énergétique */}
          <Animated.View style={[styles.ringContainer, ring2Style]}>
            <Svg width={180} height={180} viewBox="0 0 180 180">
              <Circle
                cx="90"
                cy="90"
                r="82"
                stroke="#38BDF8"
                strokeWidth="1.4"
                strokeDasharray="14 8"
                fill="none"
                opacity={0.65}
              />
              {/* Photon en orbite cyan */}
              <Circle cx="90" cy="8" r="3.5" fill="#38BDF8" opacity={0.9} />
            </Svg>
          </Animated.View>

          {/* Cœur Solaire fusionnel 3D */}
          <Svg width={96} height={96} viewBox="0 0 96 96">
            <Defs>
              <RadialGradient id="innerFusion" cx="40%" cy="35%" rx="55%" ry="55%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                <Stop offset="25%" stopColor="#FFE066" stopOpacity="1" />
                <Stop offset="65%" stopColor="#FFB800" stopOpacity="1" />
                <Stop offset="100%" stopColor="#E07000" stopOpacity="0.95" />
              </RadialGradient>
            </Defs>
            <Circle cx="48" cy="48" r="34" fill="url(#innerFusion)" />
            {/* Éclat spéculaire blanc au sommet */}
            <Circle cx="40" cy="38" r="10" fill="#FFFFFF" opacity={0.35} />
          </Svg>
        </Animated.View>

        {/* 2. Faisceau d'Énergie Photonique (Phase 3) */}
        <Animated.View style={[styles.beamContainer, energyBeamStyle]}>
          <Svg width={120} height={120} viewBox="0 0 120 120">
            <Defs>
              <LinearGradient id="streamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#FFB800" stopOpacity="0.9" />
                <Stop offset="50%" stopColor="#38BDF8" stopOpacity="0.7" />
                <Stop offset="100%" stopColor="#FFEAA7" stopOpacity="0.1" />
              </LinearGradient>
            </Defs>
            {/* Lignes de flux d'énergie */}
            <Path
              d="M 60 0 C 45 40, 75 70, 60 120"
              stroke="url(#streamGrad)"
              strokeWidth="3.2"
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d="M 52 10 C 35 45, 65 75, 52 120"
              stroke="#FFD166"
              strokeWidth="1.6"
              strokeDasharray="6 4"
              fill="none"
              opacity={0.7}
            />
            <Path
              d="M 68 15 C 80 50, 50 85, 68 120"
              stroke="#38BDF8"
              strokeWidth="1.6"
              strokeDasharray="6 4"
              fill="none"
              opacity={0.7}
            />
          </Svg>
        </Animated.View>

        {/* 3. Wireframe Villa Méditerranéenne & Panneaux Solaires (Phase 3) */}
        <Animated.View style={[styles.villaContainer, villaStyle]}>
          <Svg width={320} height={150} viewBox="0 0 320 150">
            <Defs>
              <LinearGradient id="panelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FFB800" stopOpacity="0.95" />
                <Stop offset="100%" stopColor="#FF8A00" stopOpacity="0.85" />
              </LinearGradient>
              <LinearGradient id="windowWarm" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#FFEAA7" stopOpacity="0.9" />
                <Stop offset="100%" stopColor="#FFB800" stopOpacity="0.4" />
              </LinearGradient>
            </Defs>

            {/* Ligne de sol architecturale */}
            <Line
              x1="20"
              y1="140"
              x2="300"
              y2="140"
              stroke="rgba(245, 232, 211, 0.25)"
              strokeWidth="1.5"
            />

            {/* Volume Villa contemporaine : Lignes épurées */}
            {/* Corps principal */}
            <Rect
              x="55"
              y="55"
              width="210"
              height="85"
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="1.6"
              fill="rgba(21, 30, 43, 0.7)"
              rx="3"
            />

            {/* Toit terrasse plat avec acrotère */}
            <Rect
              x="45"
              y="45"
              width="230"
              height="10"
              stroke="#FFE29A"
              strokeWidth="1.8"
              fill="rgba(255, 184, 0, 0.15)"
              rx="2"
            />

            {/* 6 Panneaux Photovoltaïques sur le toit terrasse */}
            {PANELS.map((p) => (
              <G key={p.id}>
                <Rect
                  x={p.x - 70}
                  y={22}
                  width={p.w}
                  height={18}
                  fill="url(#panelGrad)"
                  stroke="#FFFDF7"
                  strokeWidth="1"
                  rx="1.5"
                />
                {/* Lignes de cellules photovoltaïques */}
                <Line
                  x1={p.x - 70}
                  y1={31}
                  x2={p.x - 70 + p.w}
                  y2={31}
                  stroke="#FFFFFF"
                  strokeWidth="0.6"
                  opacity={0.8}
                />
                <Line
                  x1={p.x - 70 + p.w / 2}
                  y1={22}
                  x2={p.x - 70 + p.w / 2}
                  y2={40}
                  stroke="#FFFFFF"
                  strokeWidth="0.6"
                  opacity={0.8}
                />
              </G>
            ))}

            {/* Grande baie vitrée panoramique illuminée par l'énergie solaire */}
            <Rect
              x="85"
              y="75"
              width="100"
              height="55"
              fill="url(#windowWarm)"
              stroke="#FFEAA7"
              strokeWidth="1.4"
              rx="2"
            />
            {/* Montants fins de la baie vitrée */}
            <Line x1="135" y1="75" x2="135" y2="130" stroke="#FFEAA7" strokeWidth="1" opacity={0.6} />
            <Line x1="85" y1="102" x2="185" y2="102" stroke="#FFEAA7" strokeWidth="0.8" opacity={0.5} />

            {/* Entrée architecturale & porte */}
            <Rect
              x="210"
              y="85"
              width="32"
              height="55"
              stroke="rgba(255, 255, 255, 0.35)"
              strokeWidth="1.2"
              fill="rgba(255, 184, 0, 0.08)"
              rx="1.5"
            />
            <Circle cx="236" cy="115" r="1.8" fill="#FFB800" />
          </Svg>
        </Animated.View>

        {/* 4. Typographie Cinétique & Logo Reveal (Phase 4) */}
        <Animated.View style={[styles.logoBlock, logoTextStyle]}>
          {/* Ligne Logo Marque : smart solar° */}
          <View style={styles.brandTitleRow}>
            <Text style={styles.smartText}>smart</Text>
            <Text style={styles.solarText}>solar</Text>
            <View style={styles.degreeContainer}>
              <Text style={styles.degreeSymbol}>°</Text>
              {/* Éclat étincelle or sur le degré */}
              <Svg width={18} height={18} viewBox="0 0 18 18" style={styles.sparkleSvg}>
                <Polygon
                  points="9,0 11,7 18,9 11,11 9,18 7,11 0,9 7,7"
                  fill="#FFB800"
                  opacity={0.95}
                />
              </Svg>
            </View>

            {/* Balayage spéculaire (shimmer) */}
            <Animated.View style={[styles.shimmerBand, shimmerStyle]} pointerEvents="none" />
          </View>

          {/* Ligne Séparateur Lumineux */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerGlow} />
          </View>

          {/* Slogans et Vision */}
          <Animated.View style={[styles.taglineContainer, taglineStyle]}>
            <Text style={styles.frenchSlogan}>L’ÉNERGIE SOLAIRE INTELLIGENTE</Text>
            <Text style={styles.englishSlogan}>Your energy. Your future.</Text>

            {/* Badge Haute Technologie */}
            <View style={styles.techPill}>
              <View style={styles.techDot} />
              <Text style={styles.techText}>AI PVGIS • META SAM ViT-B • IoT ESP32</Text>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0B1422", // Midnight Navy profond inspiré des lanceurs Tesla & Apple
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    overflow: "hidden",
  },
  ambientGlowContainer: {
    position: "absolute",
    width: 460,
    height: 460,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  skipButton: {
    position: "absolute",
    top: 48,
    right: 24,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    zIndex: 100,
    ...Platform.select({
      web: {
        cursor: "pointer",
        backdropFilter: "blur(12px)",
      },
    }),
  },
  skipText: {
    color: "#F5E8D3",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  stage: {
    width: 380,
    height: 440,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  svgLayer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  sunContainer: {
    position: "absolute",
    top: 40,
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  raysAbsolute: {
    position: "absolute",
    width: 200,
    height: 200,
  },
  ringContainer: {
    position: "absolute",
    width: 180,
    height: 180,
  },
  beamContainer: {
    position: "absolute",
    top: 130,
    width: 120,
    height: 120,
    alignItems: "center",
  },
  villaContainer: {
    position: "absolute",
    top: 180,
    width: 320,
    height: 150,
    alignItems: "center",
  },
  logoBlock: {
    position: "absolute",
    bottom: 20,
    alignItems: "center",
    width: "100%",
  },
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    position: "relative",
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  smartText: {
    fontSize: 40,
    fontWeight: "800",
    color: "#FFFDF7",
    letterSpacing: 1.5,
  },
  solarText: {
    fontSize: 40,
    fontWeight: "300",
    color: "#F5E8D3",
    letterSpacing: 2,
    marginLeft: 3,
  },
  degreeContainer: {
    position: "relative",
    marginLeft: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  degreeSymbol: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFB800",
    top: -12,
  },
  sparkleSvg: {
    position: "absolute",
    top: -10,
    right: -10,
  },
  shimmerBand: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 50,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    transform: [{ skewX: "-25deg" }],
  },
  dividerRow: {
    width: 160,
    height: 2,
    marginTop: 8,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dividerGlow: {
    width: "100%",
    height: 1.5,
    backgroundColor: "#FFB800",
    opacity: 0.65,
    borderRadius: 1,
  },
  taglineContainer: {
    alignItems: "center",
    gap: 5,
  },
  frenchSlogan: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3.5,
    color: "#FFB800",
    textTransform: "uppercase",
  },
  englishSlogan: {
    fontSize: 12,
    fontWeight: "400",
    fontStyle: "italic",
    letterSpacing: 1.2,
    color: "rgba(245, 232, 211, 0.8)",
  },
  techPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 6,
  },
  techDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981", // Vert émeraude opérationnel
  },
  techText: {
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "rgba(255, 253, 247, 0.75)",
  },
});
