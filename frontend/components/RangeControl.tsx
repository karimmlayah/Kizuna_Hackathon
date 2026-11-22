import React, { useRef, useState } from "react";
import { View, PanResponder, type ViewInstance } from "react-native";
export function RangeControl({
  value,
  min,
  max,
  step,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [width, setWidth] = useState(1);
  const current = useRef({ width, min, max, step, onChange });
  current.current = { width, min, max, step, onChange };
  const origin = useRef(0);
  const track=useRef<ViewInstance>(null);
  const change = (x: number) => {
    if(!Number.isFinite(x))return;
    const p = current.current;
    const raw = p.min + Math.max(0, Math.min(1, x / p.width)) * (p.max - p.min);
    p.onChange(
      Math.max(
        p.min,
        Math.min(p.max, Math.round((raw - p.min) / p.step) * p.step + p.min),
      ),
    );
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const pageX=e.nativeEvent.pageX;
        track.current?.measureInWindow((left: number)=>{
          origin.current=pageX-left;
          change(origin.current);
        });
      },
      onPanResponderMove: (_, g) => change(origin.current + g.dx),
    }),
  ).current;
  return (
    <View
      ref={track}
      {...pan.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) =>
        onChange(
          Math.max(
            min,
            Math.min(
              max,
              value + (e.nativeEvent.actionName === "increment" ? step : -step),
            ),
          ),
        )
      }
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flex: 1, height: 32, justifyContent: "center" }}
    >
      <View style={{ height: 5, backgroundColor: "#E5ECE8", borderRadius: 5 }}>
        <View
          style={{
            width: `${Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))}%`,
            height: 5,
            backgroundColor: "#10B981",
            borderRadius: 5,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: `${Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))}%`,
            marginLeft: -8,
            top: -5,
            width: 16,
            height: 16,
            borderRadius: 9,
            backgroundColor: "#064E3B",
            borderWidth: 3,
            borderColor: "white",
          }}
        />
      </View>
    </View>
  );
}
