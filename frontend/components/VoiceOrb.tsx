import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Mic, Sparkles, Volume2, Loader2, Sun } from "lucide-react-native";

export type VoiceState = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

interface VoiceOrbProps {
  state: VoiceState;
  volume?: number; // 0.0 to 1.0
  size?: number;
  label?: string;
}

export function VoiceOrb({
  state,
  volume = 0.2,
  size = 140,
  label,
}: VoiceOrbProps) {
  // Shared animation values
  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    if (state === "listening") {
      scale.value = withRepeat(
        withTiming(1.15 + volume * 0.25, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      pulse.value = withRepeat(
        withTiming(1.4, { duration: 900, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      glowOpacity.value = withRepeat(
        withTiming(0.8, { duration: 600 }),
        -1,
        true
      );
    } else if (state === "thinking" || state === "transcribing") {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 600 }),
          withTiming(0.95, { duration: 600 })
        ),
        -1,
        true
      );
      pulse.value = withRepeat(
        withTiming(1.25, { duration: 1100 }),
        -1,
        false
      );
      glowOpacity.value = 0.5;
    } else if (state === "speaking") {
      scale.value = withRepeat(
        withTiming(1.12, { duration: 350, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
      pulse.value = withRepeat(
        withTiming(1.35, { duration: 700 }),
        -1,
        false
      );
      glowOpacity.value = 0.7;
    } else {
      scale.value = withTiming(1, { duration: 400 });
      pulse.value = withTiming(1, { duration: 400 });
      glowOpacity.value = withTiming(0.35, { duration: 400 });
    }
  }, [state, volume]);

  const animatedOrbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1.4 - pulse.value,
  }));

  const statusText =
    label ||
    (state === "listening"
      ? "« Je vous écoute... »"
      : state === "transcribing"
      ? "« Transcription en cours... »"
      : state === "thinking"
      ? "« Solar AI réfléchit... »"
      : state === "speaking"
      ? "« Solar AI vous répond »"
      : "« En attente vocale »");

  const colors =
    state === "listening"
      ? ["#FFB800", "#FF8A00", "#D97706"]
      : state === "speaking"
      ? ["#F59E0B", "#10B981", "#059669"]
      : state === "thinking" || state === "transcribing"
      ? ["#38BDF8", "#0284C7", "#1E3A8A"]
      : ["#FFE29A", "#FFB800", "#D97706"];

  return (
    <View style={[styles.container, { width: size * 1.6, height: size * 1.6 }]}>
      {/* Outer Pulse Ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size * 1.35,
            height: size * 1.35,
            borderRadius: (size * 1.35) / 2,
            borderColor: state === "speaking" ? "#10B981" : "#FFB800",
          },
          animatedPulseStyle,
        ]}
      />

      {/* Glow Halo */}
      <View
        style={[
          styles.glowHalo,
          {
            width: size * 1.2,
            height: size * 1.2,
            borderRadius: (size * 1.2) / 2,
            backgroundColor: state === "speaking" ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 184, 0, 0.25)",
          },
        ]}
      />

      {/* Main Glowing Solar Orb */}
      <Animated.View
        style={[
          styles.mainOrb,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          animatedOrbStyle,
        ]}
      >
        <LinearGradient
          colors={colors as any}
          start={{ x: 0.15, y: 0.15 }}
          end={{ x: 0.85, y: 0.85 }}
          style={styles.gradientOrb}
        >
          {state === "listening" ? (
            <Mic size={size * 0.35} color="#FFFFFF" strokeWidth={2.5} />
          ) : state === "speaking" ? (
            <Volume2 size={size * 0.35} color="#FFFFFF" strokeWidth={2.5} />
          ) : state === "thinking" || state === "transcribing" ? (
            <Sparkles size={size * 0.35} color="#FFFFFF" strokeWidth={2.5} />
          ) : (
            <Sun size={size * 0.35} color="#FFFFFF" strokeWidth={2.5} />
          )}
        </LinearGradient>
      </Animated.View>

      {/* Reactive State Label */}
      <View style={styles.labelContainer}>
        <Text style={styles.labelText}>{statusText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 2,
  },
  glowHalo: {
    position: "absolute",
  },
  mainOrb: {
    shadowColor: "#FFB800",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
    overflow: "hidden",
  },
  gradientOrb: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  labelContainer: {
    position: "absolute",
    bottom: -8,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FFE29A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  labelText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B45309",
    letterSpacing: 0.2,
  },
});
