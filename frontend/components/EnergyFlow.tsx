import React, { useEffect } from "react";
import { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  cancelAnimation,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { useMotion } from "../hooks/useMotion";
import { theme } from "../theme";

const Dot = Animated.createAnimatedComponent(Circle);

export function EnergyFlow({ intensity = 1 }: { intensity?: number }) {
  const motion = useMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (motion) {
      progress.value = withRepeat(
        withTiming(1, {
          duration: 3800 / Math.max(0.5, intensity),
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    } else {
      cancelAnimation(progress);
    }
    return () => cancelAnimation(progress);
  }, [motion, intensity]);

  const props = useAnimatedProps(() => ({
    cx: interpolate(progress.value, [0, 0.4, 0.7, 1], [285, 285, 400, 560]),
    cy: interpolate(progress.value, [0, 0.4, 0.7, 1], [191, 330, 386, 305]),
  }));

  return (
    <Dot
      animatedProps={props}
      r={5.5}
      fill="#FFFDF5"
      stroke={theme.colors.gold}
      strokeWidth={2.5}
    />
  );
}
