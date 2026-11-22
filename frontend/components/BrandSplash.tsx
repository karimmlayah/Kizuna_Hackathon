import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { Sun } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useMotion } from "../hooks/useMotion";
import { theme } from "../theme";

export function BrandSplash({ onDone }: { onDone: () => void }) {
  const progress = useSharedValue(0);
  const motion = useMotion();

  useEffect(() => {
    progress.value = withTiming(1, { duration: motion ? 700 : 0 });
    const t = setTimeout(onDone, motion ? 1100 : 150);
    return () => clearTimeout(t);
  }, [motion, onDone]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.2 + progress.value * 0.8,
    transform: [{ scale: 0.88 + progress.value * 0.12 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.6,
    transform: [{ scale: 0.7 + progress.value * 0.5 }],
  }));

  return (
    <View
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: theme.colors.midnight,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      {/* Halo Solaire doux */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: "rgba(255, 184, 0, 0.18)",
          },
          glowStyle,
        ]}
      />

      <Animated.View style={[{ alignItems: "center", gap: 20 }, style]}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 28,
            backgroundColor: "rgba(255, 184, 0, 0.12)",
            borderWidth: 1.5,
            borderColor: "rgba(255, 184, 0, 0.4)",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: theme.colors.gold,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
          }}
        >
          <Sun size={52} color={theme.colors.gold} strokeWidth={2.2} />
        </View>

        <Text
          style={{
            fontSize: 38,
            fontWeight: "800",
            color: "#FFFFFF",
            letterSpacing: -1.2,
          }}
        >
          smart<Text style={{ fontWeight: "400" }}>solar</Text>
          <Text style={{ color: theme.colors.gold }}>°</Text>
        </Text>

        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: theme.colors.amberLight,
            letterSpacing: 4,
          }}
        >
          L'ÉNERGIE SOLAIRE INTELLIGENTE
        </Text>
      </Animated.View>
    </View>
  );
}
