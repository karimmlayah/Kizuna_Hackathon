import React from "react";
import { View, Pressable, Text } from "react-native";
import Svg, { Polygon, Rect, Path, Ellipse, G, Line } from "react-native-svg";
import type { SceneProps } from "./SolarScene.types";
import { EnergyFlow } from "../components/EnergyFlow";
import { theme } from "../theme";

export default function SolarScene({
  night,
  onSelect,
  intensity = 1,
}: SceneProps) {
  return (
    <View style={{ flex: 1, minHeight: 300, justifyContent: "center" }}>
      <Svg viewBox="0 0 700 440" width="100%" height="100%">
        {/* Halo et ombre douce du sol */}
        <Ellipse
          cx="350"
          cy="353"
          rx="240"
          ry="55"
          fill={night ? "#131C28" : "#FFF5DC"}
        />

        {/* Terrasse architecturale et socle */}
        <Polygon
          points="70,270 355,140 645,285 350,420"
          fill={night ? "#1E2B3A" : "#F4E8CE"}
        />
        <Polygon
          points="175,220 354,134 532,225 351,317"
          fill={night ? "#263547" : "#FCF8F0"}
        />
        <Polygon
          points="175,220 351,309 351,358 175,271"
          fill={night ? "#1A2534" : "#FDFBF7"}
        />
        <Polygon
          points="351,309 532,219 532,275 351,358"
          fill={night ? "#16202D" : "#EDE5D4"}
        />

        {/* Étage supérieur / volume moderne */}
        <Polygon
          points="188,162 355,85 516,168 350,253"
          fill={night ? "#2D3E52" : "#FFFDF8"}
        />
        <Polygon
          points="188,162 350,245 350,307 188,226"
          fill={night ? "#223041" : "#FFFFFF"}
        />
        <Polygon
          points="350,245 516,162 516,224 350,307"
          fill={night ? "#1C2735" : "#E8DFCD"}
        />

        {/* 12 Panneaux Solaires Monocristallins Premium */}
        {Array.from({ length: 12 }, (_, i) => {
          const x = 218 + (i % 4) * 35 + Math.floor(i / 4) * 24,
            y = 157 + (i % 4) * 18 - Math.floor(i / 4) * 12;
          return (
            <Polygon
              key={i}
              points={`${x},${y} ${x + 29},${y + 15} ${x + 48},${y + 6} ${x + 19},${y - 9}`}
              fill={night ? "#070E18" : "#0D1826"}
              stroke={night ? "#1E3A5F" : "#38BDF8"}
              strokeWidth="0.8"
            />
          );
        })}

        {/* Baies vitrées & reflets solaires */}
        <Polygon
          points="213,196 318,250 318,281 213,229"
          fill={night ? "#FFB800" : "#FFE5A0"}
          opacity={night ? 0.95 : 0.85}
        />
        <Polygon
          points="375,252 496,192 496,219 375,281"
          fill={night ? "#FF9800" : "#FFEDB3"}
          opacity={night ? 0.95 : 0.85}
        />
        <Polygon
          points="385,311 490,260 490,283 385,335"
          fill={night ? "#2A394A" : "#D4C7AE"}
        />

        {/* Végétation stylisée méditerranéenne (cyprès / oliviers) */}
        {[0, 1, 2].map((i) => (
          <G key={i}>
            <Rect
              x={115 + i * 24}
              y={262 + i * 16}
              width="6"
              height="47"
              fill={night ? "#2E3B46" : "#A89A78"}
            />
            <Ellipse
              cx={118 + i * 24}
              cy={257 + i * 16}
              rx="19"
              ry="28"
              fill={night ? "#1E3A2F" : "#7A9A70"}
            />
          </G>
        ))}

        {/* Ligne d'énergie solaire dorée animée */}
        <Path
          d="M285 191 L285 330 L400 386 L560 305"
          fill="none"
          stroke={theme.colors.gold}
          strokeWidth="3.5"
          strokeDasharray="8 6"
        />

        {/* Boîtier Onduleur / Smart Box */}
        <Rect
          x="283"
          y="282"
          width="24"
          height="38"
          rx="6"
          fill="#FFFFFF"
          stroke="#FFE29A"
          strokeWidth="1.5"
        />
        <Line
          x1="288"
          x2="301"
          y1="289"
          y2="289"
          stroke={theme.colors.gold}
          strokeWidth="3"
        />

        {/* Particule solaire animée */}
        <EnergyFlow intensity={intensity} />
      </Svg>

      {/* Boutons sélecteurs de zones flottants */}
      <View
        style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          right: 16,
          flexDirection: "row",
          gap: 8,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        {(["Panneaux", "Batterie", "Onduleur", "Réseau"] as const).map((x) => (
          <Pressable
            key={x}
            accessibilityRole="button"
            onPress={() => onSelect?.(x)}
            style={{
              backgroundColor: night ? "rgba(23, 33, 46, 0.88)" : "#FFFFFFEE",
              borderWidth: 1.5,
              borderColor: night ? "rgba(255, 184, 0, 0.35)" : "#FFE29A",
              paddingHorizontal: 13,
              paddingVertical: 8,
              borderRadius: 14,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: night ? theme.colors.amberLight : theme.colors.midnight,
              }}
            >
              {x}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
