import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  PanResponder,
  type LayoutChangeEvent,
  type PressableInstance,
} from "react-native";
import Svg, { Rect, Line, Polygon } from "react-native-svg";
import { Image } from "expo-image";
import { useSolarStore } from "../store/useSolarStore";
import type { RoofPanel } from "../types";
import { PremiumButton, Stepper, Copy, s, colors } from "./ui";
function Panel({
  panel,
  selected,
  onSelect,
  onMove,
  width,
  height,
  zoom,
  number,
}: {
  panel: RoofPanel;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  width: number;
  height: number;
  zoom: number;
  number: number;
}) {
  const latest = useRef({ panel, onMove, onSelect, width, height, zoom });
  latest.current = { panel, onMove, onSelect, width, height, zoom };
  const origin = useRef({ x: 0, y: 0 });
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const p = latest.current;
        origin.current = { x: p.panel.x, y: p.panel.y };
        p.onSelect();
      },
      onPanResponderMove: (_, g) => {
        const p = latest.current;
        p.onMove(
          Math.max(
            4,
            Math.min(88, origin.current.x + ((g.dx / p.width) * 100) / p.zoom),
          ),
          Math.max(
            5,
            Math.min(78, origin.current.y + ((g.dy / p.height) * 100) / p.zoom),
          ),
        );
      },
    }),
  ).current;
  return (
    <View
      {...pan.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Panneau ${number}, sélectionnez puis déplacez avec les boutons de direction`}
      style={{
        position: "absolute",
        left: `${panel.x}%`,
        top: `${panel.y}%`,
        width: "9%",
        height: "18%",
        backgroundColor: "#0A131F",
        borderWidth: selected ? 2.5 : 1,
        borderColor: selected ? "#FFB800" : "#38BDF8",
        borderRadius: 4,
        transform: [{ rotate: `${panel.rotation}deg` }],
        shadowColor: selected ? "#FFB800" : "#000000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: selected ? 0.45 : 0.2,
        shadowRadius: selected ? 8 : 4,
        elevation: selected ? 4 : 2,
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 40 70" preserveAspectRatio="none">
        {[10, 20, 30].map((x) => (
          <Line
            key={x}
            x1={x}
            y1="0"
            x2={x}
            y2="70"
            stroke="#628593"
            strokeWidth=".5"
          />
        ))}
        {[14, 28, 42, 56].map((y) => (
          <Line
            key={y}
            x1="0"
            y1={y}
            x2="40"
            y2={y}
            stroke="#628593"
            strokeWidth=".5"
          />
        ))}
      </Svg>
    </View>
  );
}
export function RoofCanvas({ uri }: { uri?: string }) {
  const { panels, set } = useSolarStore();
  const [selected, select] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [zoneMode, setZoneMode] = useState(false);
  const [zone, setZone] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: 600, height: 430 });
  const zoneTarget=useRef<PressableInstance>(null);
  const update = (id: number, patch: Partial<RoofPanel>) =>
    set({ panels: panels.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const chosen = panels.find((p) => p.id === selected);
  return (
    <View style={{ gap: 18 }}>
      <View
        style={[s.row, { justifyContent: "space-between", flexWrap: "wrap" }]}
      >
        <Text style={{ fontSize: 20, color: colors.midnight, fontWeight: "800" }}>
          {panels.length} panneaux · plan d'implantation
        </Text>
        <View style={[s.row, { flexWrap: "wrap" }]}>
          <PremiumButton
            title="Ajouter un panneau"
            onPress={() => {
              const id = Date.now();
              set({
                panels: [
                  ...panels,
                  { id, x: zone?.x ?? 40, y: zone?.y ?? 40, rotation: 0 },
                ],
              });
              select(id);
            }}
          />
          <PremiumButton
            title={zoneMode ? "Annuler la zone" : "Définir une zone"}
            secondary
            onPress={() => {
              setZoneMode(!zoneMode);
              setStart(null);
            }}
          />
        </View>
      </View>
      {zoneMode && (
        <Copy>
          Touchez deux coins opposés pour définir une zone rectangulaire.{" "}
          {start ? "Choisissez maintenant le second coin." : ""}
        </Copy>
      )}
      <View
        onLayout={(e) => setSize(e.nativeEvent.layout)}
        style={{
          height: 430,
          borderRadius: 22,
          overflow: "hidden",
          backgroundColor: "#EFE7D5",
          borderWidth: 1.5,
          borderColor: "#FFE29A",
        }}
      >
        <View style={{ flex: 1, transform: [{ scale: zoom }] }}>
          {uri ? (
            <Image
              source={{ uri }}
              style={{ position: "absolute", width: "100%", height: "100%" }}
              contentFit="fill"
            />
          ) : (
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 600 430"
              preserveAspectRatio="none"
            >
              <Rect width="600" height="430" fill="#EFE7D5" />
              <Rect
                x="65"
                y="48"
                width="470"
                height="334"
                rx="4"
                fill="#DDD2BD"
              />
              <Rect x="75" y="58" width="450" height="314" fill="#FAF6EE" />
              <Rect x="88" y="72" width="424" height="286" fill="#F2EBDC" />
              {Array.from({ length: 10 }, (_, i) => (
                <Line
                  key={i}
                  x1="88"
                  x2="512"
                  y1={80 + i * 30}
                  y2={80 + i * 30}
                  stroke="#E0D5BE"
                />
              ))}
              <Rect x="415" y="260" width="75" height="72" fill="#D3C7AE" />
              <Rect x="410" y="255" width="75" height="72" fill="#FAF6EE" />
            </Svg>
          )}
          {zone && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zone.w}%`,
                height: `${zone.h}%`,
                backgroundColor: "rgba(255, 184, 0, 0.16)",
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: "#FFB800",
              }}
            />
          )}
          {panels.map((panel,index) => (
            <Panel
              key={panel.id}
              panel={panel}
              number={index+1}
              width={size.width}
              height={size.height}
              zoom={zoom}
              selected={selected === panel.id}
              onSelect={() => select(panel.id)}
              onMove={(x, y) => update(panel.id, { x, y })}
            />
          ))}
          {zoneMode && (
            <Pressable
              ref={zoneTarget}
              accessibilityLabel="Définir les coins de la zone"
              onPress={(e) => {
                const {pageX,pageY}=e.nativeEvent;
                zoneTarget.current?.measureInWindow((left: number, top: number, w: number, h: number)=>{
                const x = Math.max(0,Math.min(100,(pageX-left)/w*100)),
                  y = Math.max(0,Math.min(100,(pageY-top)/h*100));
                if(!Number.isFinite(x)||!Number.isFinite(y))return;
                if (!start) setStart({ x, y });
                else {
                  setZone({
                    x: Math.min(x, start.x),
                    y: Math.min(y, start.y),
                    w: Math.abs(x - start.x),
                    h: Math.abs(y - start.y),
                  });
                  setStart(null);
                  setZoneMode(false);
                }
                });
              }}
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(255, 184, 0, 0.06)",
              }}
            />
          )}
        </View>
      </View>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <PremiumButton
          title="Tourner 90°"
          disabled={!chosen}
          secondary
          onPress={() =>
            chosen &&
            update(chosen.id, { rotation: (chosen.rotation + 90) % 360 })
          }
        />
        <PremiumButton
          title="Supprimer"
          disabled={!chosen}
          secondary
          onPress={() => {
            set({ panels: panels.filter((p) => p.id !== selected) });
            select(null);
          }}
        />
        {[
          ["Gauche", -2, 0],
          ["Droite", 2, 0],
          ["Haut", 0, -2],
          ["Bas", 0, 2],
        ].map(([label, dx, dy]) => (
          <PremiumButton
            key={String(label)}
            title={String(label)}
            disabled={!chosen}
            secondary
            onPress={() =>
              chosen &&
              update(chosen.id, {
                x: Math.min(88, Math.max(4, chosen.x + Number(dx))),
                y: Math.min(78, Math.max(5, chosen.y + Number(dy))),
              })
            }
          />
        ))}
      </View>
      <Stepper
        label="Zoom"
        value={zoom}
        min={1}
        max={1.8}
        step={0.2}
        unit="×"
        onChange={(v) => setZoom(Math.round(v * 10) / 10)}
      />
      <Copy>
        Glissez les panneaux pour les déplacer. La zone est un repère visuel ;
        les collisions, marges de sécurité et distances réelles ne sont pas
        calculées. Sans échelle, aucune surface réelle ne peut être déduite.
        Positions sauvegardées localement.
      </Copy>
    </View>
  );
}
