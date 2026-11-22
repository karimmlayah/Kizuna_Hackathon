import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
  type ViewStyle,
} from "react-native";
import { Sun, Plus, Minus, Sparkles } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useMotion } from "../hooks/useMotion";
import { theme } from "../theme";
import { RangeControl } from "./RangeControl";
import { useSolarStore } from "../store/useSolarStore";

export const colors = theme.colors;

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}

export function Copy({ children }: { children: React.ReactNode }) {
  return <Text style={s.copy}>{children}</Text>;
}

export function Logo({ onPress }: { onPress?: () => void } = {}) {
  const trigger = useSolarStore((state) => state.triggerCinematicSplash);
  const handlePress = onPress ?? trigger;
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Smart Solar - Rejouer l'introduction cinématographique"
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={s.logo}>
        <Sun size={22} color="#FFFFFF" strokeWidth={2.4} />
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "800",
          letterSpacing: -0.8,
          color: colors.ink,
        }}
      >
        smart<Text style={{ fontWeight: "400", color: colors.ink }}>solar</Text>
        <Text style={{ color: colors.gold, fontWeight: "900" }}>°</Text>
      </Text>
    </Pressable>
  );
}

export function PremiumButton({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const content = (
    <Text
      style={{
        fontSize: 14,
        fontWeight: "700",
        letterSpacing: -0.2,
        color: secondary ? colors.midnight : "#FFFFFF",
      }}
    >
      {title}
    </Text>
  );

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        if (Platform.OS !== "web") void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        s.buttonBase,
        secondary ? s.buttonSecondary : s.buttonPrimaryShadow,
        {
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {secondary ? (
        <View style={s.buttonSecondaryContent}>{content}</View>
      ) : (
        <LinearGradient
          colors={theme.gradients.solar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.buttonGradient}
        >
          {content}
        </LinearGradient>
      )}
    </Pressable>
  );
}

export function GlassPanel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const motion = useMotion();
  return (
    <Animated.View
      entering={motion ? FadeInDown.duration(380) : undefined}
      style={[s.panel, style]}
    >
      {children}
    </Animated.View>
  );
}

export function StatusIndicator({
  label = "Démonstration interactive",
}: {
  label?: string;
}) {
  return (
    <View style={s.badge}>
      <View style={s.badgeDot} />
      <Text style={s.badgeText}>{label}</Text>
    </View>
  );
}

export function AnimatedCounter({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const [v, setV] = useState(value);
  const motion = useMotion();
  useEffect(() => {
    if (!motion) {
      setV(value);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 600);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p === 1) clearInterval(timer);
    }, 32);
    return () => clearInterval(timer);
  }, [value, motion]);
  return (
    <Text style={s.number}>
      {v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
      <Text style={{ fontSize: 16, fontWeight: "500", color: colors.muted }}>
        {" "}
        {suffix}
      </Text>
    </Text>
  );
}

export function SolarMetric({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: number;
  unit: string;
  note: string;
}) {
  return (
    <GlassPanel style={{ flex: 1, minWidth: 155 }}>
      <Label>{label}</Label>
      <AnimatedCounter value={value} suffix={unit} />
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
        {note}
      </Text>
    </GlassPanel>
  );
}

export function Field({
  label,
  value,
  onChange,
  numeric = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  numeric?: boolean;
}) {
  return (
    <View style={{ gap: 8, marginVertical: 8 }}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        style={s.input}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        placeholderTextColor="#94A3B8"
      />
    </View>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <View style={{ gap: 12, marginVertical: 12 }}>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Label>{label}</Label>
        <Text style={{ fontWeight: "700", color: colors.ink }}>
          {value.toLocaleString("fr-FR")} {unit}
        </Text>
      </View>
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Diminuer ${label}`}
          onPress={() => onChange(Math.max(min, value - step))}
          style={s.small}
        >
          <Minus size={16} color={colors.ink} />
        </Pressable>
        <RangeControl
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={onChange}
          label={label}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Augmenter ${label}`}
          onPress={() => onChange(Math.min(max, value + step))}
          style={s.small}
        >
          <Plus size={16} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

export function StepIndicator({
  step,
  labels,
}: {
  step: number;
  labels: string[];
}) {
  return (
    <View style={[s.row, { flexWrap: "wrap", marginBottom: 24, gap: 8 }]}>
      {labels.map((l, i) => (
        <View
          key={l}
          style={[
            s.badge,
            {
              backgroundColor: i <= step ? "#FEF3C7" : "#F1F5F9",
              borderColor: i <= step ? "#FDE68A" : "#E2E8F0",
            },
          ]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: i <= step ? "700" : "500",
              color: i <= step ? "#92400E" : colors.muted,
            }}
          >
            {i + 1} · {l}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={{ padding: 30, gap: 10 }}>
      <Title>{title}</Title>
      <Copy>{description}</Copy>
    </View>
  );
}

export function LoadingSkeleton() {
  const motion = useMotion();
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = motion
      ? withRepeat(withTiming(1, { duration: 700 }), -1, true)
      : 1;
  }, [motion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        { height: 80, borderRadius: 18, backgroundColor: "#FEF3C7" },
        style,
      ]}
    />
  );
}

export const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: colors.ink,
  },
  copy: { fontSize: 16, lineHeight: 25, color: colors.muted },
  logo: {
    backgroundColor: colors.gold,
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFB800",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonBase: {
    borderRadius: 15,
    overflow: "hidden",
  },
  buttonPrimaryShadow: {
    shadowColor: "#FF8A00",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 4,
  },
  buttonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSecondary: {
    backgroundColor: "#FFF9ED",
    borderWidth: 1.5,
    borderColor: "#FFE29A",
  },
  buttonSecondaryContent: {
    paddingHorizontal: 22,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    padding: 24,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1ECE1",
    gap: 8,
    ...theme.shadow,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D97706",
  },
  badgeText: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "700",
  },
  number: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1.2,
    color: colors.ink,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#FFFDF9",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: colors.ink,
  },
  small: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFF9ED",
    borderWidth: 1,
    borderColor: "#FFE29A",
    alignItems: "center",
    justifyContent: "center",
  },
});
