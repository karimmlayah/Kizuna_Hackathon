import React, { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import Svg, {
  Path,
  Line,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Text as SvgText,
} from "react-native-svg";
import { colors, s } from "./ui";
import { theme } from "../theme";

export function EnergyChart({
  values,
  labels,
  unit = "kWh",
  height = 175,
}: {
  values: number[];
  labels?: string[];
  unit?: string;
  height?: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(...values, 1),
    min = Math.min(...values, 0),
    span = max - min || 1;
  const pts = values.map((v, i) => [
    20 + (i * 560) / Math.max(1, values.length - 1),
    140 - ((v - min) / span) * 120,
  ]);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");

  return (
    <View style={{ gap: 10 }}>
      {selected !== null && (
        <View
          style={[
            s.row,
            {
              alignSelf: "center",
              backgroundColor: "#FFF9ED",
              borderWidth: 1,
              borderColor: "#FFE29A",
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 16,
              gap: 6,
            },
          ]}
        >
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>
            {labels?.[selected] ?? `Point ${selected + 1}`} :
          </Text>
          <Text style={{ fontSize: 13, fontWeight: "800", color: "#D97706" }}>
            {values[selected]?.toFixed(1)} {unit}
          </Text>
        </View>
      )}

      <Svg viewBox="0 0 600 175" height={height} width="100%">
        <Defs>
          <LinearGradient id="solarArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFB800" stopOpacity=".35" />
            <Stop offset="0.7" stopColor="#FF8A00" stopOpacity=".08" />
            <Stop offset="1" stopColor="#FF8A00" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {[20, 60, 100, 140].map((y) => (
          <Line
            key={y}
            x1="20"
            x2="580"
            y1={y}
            y2={y}
            stroke="#F1ECE1"
            strokeDasharray="4 6"
            strokeWidth="1.2"
          />
        ))}

        <Path d={`${path} L580,140 L20,140 Z`} fill="url(#solarArea)" />

        <Path
          d={path}
          fill="none"
          stroke="#FFB800"
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {pts.map((p, i) => (
          <Circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            r={selected === i ? 7 : 4}
            fill={selected === i ? "#FF8A00" : "#FFFFFF"}
            stroke={selected === i ? "#FFFFFF" : "#FFB800"}
            strokeWidth={selected === i ? 2.5 : 2}
            {...(Platform.OS === "web"
              ? ({ onClick: () => setSelected(i), cursor: "pointer" } as any)
              : { onPress: () => setSelected(i) })}
          />
        ))}

        {[0, Math.floor((values.length - 1) / 2), values.length - 1].map(
          (i) => (
            <SvgText
              key={i}
              x={pts[i]?.[0]}
              y="168"
              fill="#94A3B8"
              fontSize="12"
              fontWeight="600"
              textAnchor={
                i === 0 ? "start" : i === values.length - 1 ? "end" : "middle"
              }
            >
              {labels?.[i] ?? `${i}`}
            </SvgText>
          ),
        )}
      </Svg>

      <View style={[s.row, { justifyContent: "center", flexWrap: "wrap", gap: 6 }]}>
        {values.map((v, i) => (
          <Pressable
            key={i}
            accessibilityLabel={`${labels?.[i] ?? i}: ${v.toFixed(1)} ${unit}`}
            onPress={() => setSelected(i)}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: i === selected ? theme.colors.gold : "#FFECC7",
              borderWidth: i === selected ? 2 : 0,
              borderColor: "#FF8A00",
            }}
          />
        ))}
      </View>
    </View>
  );
}
