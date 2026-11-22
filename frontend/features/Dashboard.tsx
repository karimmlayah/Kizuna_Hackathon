import React, { useState } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import {
  Sun,
  Moon,
  ArrowUpRight,
  BatteryCharging,
  Zap,
  House,
  Plus,
  SlidersHorizontal,
  CloudSun,
  Sparkles,
  FileText,
  PanelsTopLeft,
  ChartNoAxesCombined,
  Activity,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import SolarScene from "../scenes/SolarScene";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { SolarOverviewCard } from "../components/SolarOverviewCard";
import {
  GlassPanel,
  Title,
  Copy,
  Label,
  StatusIndicator,
  SolarMetric,
  PremiumButton,
  colors,
  s,
} from "../components/ui";
import { EnergyChart } from "../components/EnergyChart";
import { useSolarStore } from "../store/useSolarStore";
import { daily, weekly } from "../mocks/energy";
import type { Equipment } from "../types";
import { theme } from "../theme";

export default function Dashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width > 1250;
  const { name, night, set } = useSolarStore();
  const [selected, select] = useState<Equipment | null>(null);
  const [range, setRange] = useState("Jour");
  const [intensity, setIntensity] = useState(1);

  return (
    <ResponsiveLayout>
      {/* En-tête d'accueil chaleureux & lumineux */}
      <View
        style={[
          s.row,
          {
            justifyContent: "space-between",
            marginBottom: 28,
            flexWrap: "wrap",
            gap: 20,
          },
        ]}
      >
        <View style={{ gap: 6, maxWidth: "100%", flexShrink: 1 }}>
          <View style={s.row}>
            <Sparkles size={14} color={theme.colors.gold} />
            <Label>VOTRE ÉNERGIE SOLAIRE, EN HARMONIE</Label>
          </View>
          <Title>Bonjour, {name}.</Title>
          <Copy>Une journée rayonnante pour produire votre propre énergie.</Copy>
        </View>

        {/* Météo & Avatar profil */}
        <View style={s.row}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: "#FFF9ED",
              borderWidth: 1.5,
              borderColor: "#FFE29A",
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
            }}
          >
            <CloudSun size={28} color="#D97706" />
            <View>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.midnight }}>
                24° <Text style={{ fontWeight: "400", color: colors.muted }}>Tunis</Text>
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "500" }}>
                Ensoleillement optimal
              </Text>
            </View>
          </View>

          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              backgroundColor: "#FEF3C7",
              borderWidth: 1.5,
              borderColor: theme.colors.gold,
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 8,
              shadowColor: theme.colors.gold,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Text style={{ color: "#92400E", fontWeight: "800", fontSize: 15 }}>
              {name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Dynamic Today's Solar Overview Section */}
      <SolarOverviewCard />

      {/* Scène Solaire Immersive Principale */}
      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        <View style={{ flex: 1 }}>
          <LinearGradient
            colors={
              night
                ? ["#17212E", "#0F172A", "#131C28"]
                : ["#FFF8EC", "#FFEFCF", "#FAF9F5"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              height: wide ? 520 : 470,
              borderRadius: 28,
              overflow: "hidden",
              borderWidth: 1.5,
              borderColor: night ? "rgba(255, 184, 0, 0.25)" : "#FFE5A3",
              shadowColor: night ? "#000000" : "#D97706",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: night ? 0.3 : 0.09,
              shadowRadius: 28,
              elevation: 4,
            }}
          >
            {/* Barre supérieure de la scène 3D */}
            <View
              style={[
                s.row,
                { padding: 22, justifyContent: "space-between", zIndex: 2 },
              ]}
            >
              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    fontSize: 19,
                    fontWeight: "800",
                    color: night ? "#FFFFFF" : colors.midnight,
                    letterSpacing: -0.3,
                  }}
                >
                  Votre maison. Vivante.
                </Text>
                <StatusIndicator label="Digital Twin temps réel" />
              </View>

              {/* Sélecteur Jour / Nuit */}
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: night ? "rgba(30, 41, 59, 0.9)" : "rgba(255, 255, 255, 0.9)",
                  borderWidth: 1.5,
                  borderColor: night ? "rgba(255, 184, 0, 0.3)" : "#FFE29A",
                  padding: 4,
                  borderRadius: 22,
                }}
              >
                {[false, true].map((n) => (
                  <Pressable
                    accessibilityRole="button"
                    key={String(n)}
                    accessibilityLabel={n ? "Ambiance nuit" : "Ambiance jour"}
                    onPress={() => set({ night: n })}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 18,
                      backgroundColor:
                        night === n ? (n ? "#0F172A" : theme.colors.gold) : "transparent",
                    }}
                  >
                    {n ? (
                      <Moon
                        size={17}
                        color={night === n ? "#60A5FA" : "#94A3B8"}
                        strokeWidth={2.4}
                      />
                    ) : (
                      <Sun
                        size={17}
                        color={night === n ? "#94A3B8" : "#FFFFFF"}
                        strokeWidth={2.4}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Scène Solaire (3D sur Web / Isométrique SVG sur mobile) */}
            <View style={{ flex: 1, marginTop: -30, marginBottom: -10 }}>
              <SolarScene
                night={night}
                intensity={intensity}
                onSelect={select}
              />
            </View>

            {/* Indicateur flottant : Production instantanée */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 20,
                top: 110,
                backgroundColor: night ? "rgba(23, 33, 46, 0.92)" : "rgba(255, 255, 255, 0.94)",
                borderWidth: 1.5,
                borderColor: night ? "rgba(255, 184, 0, 0.35)" : "#FFE29A",
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 20,
                gap: 4,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 10,
                elevation: 3,
              }}
            >
              <Text
                style={{
                  color: night ? theme.colors.amberLight : "#B45309",
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 0.8,
                }}
              >
                PRODUCTION SOLAIRE
              </Text>
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: "900",
                  color: night ? "#FFFFFF" : colors.midnight,
                  letterSpacing: -0.5,
                }}
              >
                {night ? "0,0" : "4,8"}{" "}
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#D97706" }}>kW</Text>
              </Text>
            </View>

            {/* Indicateur flottant : Batterie */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 20,
                bottom: 85,
                backgroundColor: night ? "rgba(23, 33, 46, 0.92)" : "rgba(255, 255, 255, 0.94)",
                borderWidth: 1.5,
                borderColor: night ? "rgba(16, 185, 129, 0.35)" : "#D1FAE5",
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 18,
                gap: 5,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 10,
                elevation: 3,
              }}
            >
              <View style={s.row}>
                <BatteryCharging size={18} color={theme.colors.green} strokeWidth={2.4} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: night ? "#FFFFFF" : colors.midnight,
                  }}
                >
                  Batterie · {night ? "64" : "78"} %
                </Text>
              </View>
            </View>

            {/* Pied de la scène solaire */}
            <View
              style={[
                s.row,
                {
                  padding: 18,
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  backgroundColor: night ? "rgba(15, 23, 42, 0.4)" : "rgba(255, 255, 255, 0.4)",
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: night ? "#94A3B8" : colors.muted,
                }}
              >
                DIGITAL TWIN · {width > 700 ? "Glissez pour tourner · " : " "}
                Touchez un équipement
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIntensity((v) => (v === 1 ? 2 : 1))}
                style={[
                  s.row,
                  {
                    backgroundColor: night ? "#1E293B" : "#FFF9ED",
                    borderWidth: 1,
                    borderColor: night ? "rgba(255, 184, 0, 0.3)" : "#FFE29A",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 14,
                    gap: 6,
                  },
                ]}
              >
                <SlidersHorizontal
                  size={14}
                  color={night ? theme.colors.gold : "#D97706"}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: night ? theme.colors.gold : "#92400E",
                  }}
                >
                  Flux ×{intensity}
                </Text>
              </Pressable>
            </View>
          </LinearGradient>

          {/* Infobulle équipement sélectionné */}
          {selected && (
            <GlassPanel style={{ marginTop: 14 }}>
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <View style={s.row}>
                  <Sparkles size={16} color={theme.colors.gold} />
                  <Text style={{ fontWeight: "800", fontSize: 15, color: colors.midnight }}>
                    {selected} · équipement photovoltaïque
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Fermer l’infobulle"
                  onPress={() => select(null)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    backgroundColor: "#FFF9ED",
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#B45309" }}>Fermer</Text>
                </Pressable>
              </View>
              <Copy>
                {
                  {
                    Panneaux:
                      "12 modules monocristallins à haut rendement de 450 Wc. Puissance totale de 5,4 kWc optimisée pour votre toiture.",
                    Maison: "Consommation instantanée de votre foyer : 1,6 kW couverte à 100% par l'énergie solaire.",
                    Batterie:
                      "Stockage intelligent lithium-fer-phosphate de 10 kWh. Autonomie garantie pour la soirée et la nuit.",
                    Réseau: "Surplus solaire injecté instantanément sur le réseau : 1,2 kW valorisé sur votre facture.",
                    Onduleur: "Onduleur hybride intelligent 6 kW avec gestion dynamique des flux et rendement 98,4%.",
                  }[selected]
                }
              </Copy>
            </GlassPanel>
          )}
        </View>

        {/* Colonne latérale droite : Énergie du jour */}
        <GlassPanel style={{ width: wide ? 310 : undefined, gap: 22 }}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: colors.midnight }}>
              L’énergie du jour
            </Text>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: "#FEF3C7",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={18} color="#D97706" />
            </View>
          </View>

          <View>
            <Text
              style={{
                fontSize: 48,
                fontWeight: "900",
                letterSpacing: -2,
                color: colors.midnight,
              }}
            >
              28,6{" "}
              <Text style={{ fontSize: 20, fontWeight: "600", color: "#D97706" }}>kWh</Text>
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 4 }}>
              Production solaire enregistrée aujourd’hui
            </Text>
          </View>

          {/* 4 Flux d'énergie avec couleurs solaires & de succès */}
          <View style={{ gap: 14 }}>
            {[
              [Sun, "Production solaire", night ? "0,0 kW" : "4,8 kW", theme.colors.gold],
              [House, "Votre maison", "1,6 kW", "#38BDF8"],
              [
                BatteryCharging,
                night ? "Depuis la batterie" : "Vers la batterie",
                night ? "1,6 kW" : "2,0 kW",
                theme.colors.green,
              ],
              [Zap, "Vers le réseau", night ? "0,0 kW" : "1,2 kW", "#64748B"],
            ].map(([Icon, label, value, color]) => {
              const I = Icon as typeof Sun;
              return (
                <View
                  key={String(label)}
                  style={[s.row, { justifyContent: "space-between" }]}
                >
                  <View style={s.row}>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        backgroundColor: "#FFF9ED",
                        borderWidth: 1,
                        borderColor: "#FFE29A",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <I size={16} color={color as string} strokeWidth={2.4} />
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.midnight }}>
                      {String(label)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: colors.midnight }}>
                    {String(value)}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={{ height: 1, backgroundColor: theme.colors.line }} />

          {/* Jauge d'autonomie */}
          <View style={{ gap: 8 }}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>
                Taux d'autonomie
              </Text>
              <Text style={{ color: theme.colors.greenDark, fontWeight: "800" }}>
                82 %
              </Text>
            </View>
            <View
              style={{
                height: 8,
                backgroundColor: "#F1F5F9",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: "82%",
                  height: 8,
                  backgroundColor: theme.colors.green,
                  borderRadius: 8,
                }}
              />
            </View>
          </View>

          <PremiumButton
            title="Optimiser mon installation"
            secondary
            onPress={() => router.push("/dimensionnement")}
          />
        </GlassPanel>
      </View>

      {/* 3 Cartes Métriques Premium */}
      <View
        style={{
          flexDirection: "row",
          gap: 16,
          flexWrap: "wrap",
          marginVertical: 24,
        }}
      >
        <SolarMetric
          label="Économies ce mois"
          value={186}
          unit="TND"
          note="Gains directs constatés"
        />
        <SolarMetric
          label="Énergie solaire produite"
          value={642}
          unit="kWh"
          note="Production mensuelle consolidée"
        />
        <SolarMetric
          label="CO₂ évité estimé"
          value={289}
          unit="kg"
          note="Hypothèse : 0,45 kg CO₂ / kWh"
        />
      </View>

      {/* 4 Modules Autonomes · Accès Direct Sans Ordre Imposé */}
      <View style={{ marginBottom: 24, gap: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: "#8A7A6A", letterSpacing: 0.5, textTransform: "uppercase" }}>
          Modules Métier Autonomes · Mode IA ou Manuel au Choix
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {[
            {
              title: "Smart Monitoring IoT",
              mode: "ESP32 Live & Prédiction",
              desc: "Tension, courant, puissance & alertes dépassement",
              href: "/monitoring",
              icon: Activity,
              color: "#F59E0B",
            },
            {
              title: "Analyse Facture",
              mode: "Scan IA ou Manuel",
              desc: "Consommation kWh, barèmes STEG & budget",
              href: "/analyse",
              icon: FileText,
              color: "#38BDF8",
            },
            {
              title: "Dimensionnement",
              mode: "PVGIS ou Direct",
              desc: "Puissance crête kWc, orientation & rendement",
              href: "/dimensionnement",
              icon: SlidersHorizontal,
              color: "#FFB800",
            },
            {
              title: "Solar Design Studio",
              mode: "SAM ViT-B ou Studio",
              desc: "Segmentation toiture, obstacles & rendu 3D",
              href: "/studio",
              icon: PanelsTopLeft,
              color: "#10B981",
            },
            {
              title: "Rentabilité 25 Ans",
              mode: "Prosol ou Personnalisé",
              desc: "Amortissement, aides ANME & bénéfice net",
              href: "/rentabilite",
              icon: ChartNoAxesCombined,
              color: "#F59E0B",
            },
          ].map((mod) => {
            const ModIcon = mod.icon;
            return (
              <Pressable
                key={mod.href}
                onPress={() => router.push(mod.href as any)}
                style={{
                  flex: 1,
                  minWidth: 220,
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1.5,
                  borderColor: "#FFE29A",
                  borderRadius: 18,
                  padding: 16,
                  gap: 8,
                  shadowColor: "#FFB800",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      backgroundColor: "#FFF9ED",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "#FFE29A",
                    }}
                  >
                    <ModIcon size={18} color={mod.color} />
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#D97706", backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                    {mod.mode}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.midnight }}>
                  {mod.title}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 16 }}>
                  {mod.desc}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Section Graphique & Call-to-Action */}
      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        <GlassPanel style={{ flex: 1 }}>
          <View style={[s.row, { justifyContent: "space-between", marginBottom: 12 }]}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontWeight: "800", fontSize: 18, color: colors.midnight }}>
                Au rythme du soleil
              </Text>
              <Label>Courbe de charge et production</Label>
            </View>
            <View
              style={{
                flexDirection: "row",
                backgroundColor: "#FFF9ED",
                borderWidth: 1,
                borderColor: "#FFE29A",
                padding: 3,
                borderRadius: 14,
                gap: 4,
              }}
            >
              {["Jour", "Semaine"].map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRange(r)}
                  style={{
                    backgroundColor: r === range ? theme.colors.gold : "transparent",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 11,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: r === range ? "#FFFFFF" : colors.muted,
                    }}
                  >
                    {r}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <EnergyChart
            values={range === "Jour" ? daily : weekly}
            labels={
              range === "Jour"
                ? daily.map((_, i) => `${i + 5} h`)
                : ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
            }
            unit={range === "Jour" ? "kW" : "kWh"}
          />
        </GlassPanel>

        {/* Card Premium Appel à l'action */}
        <GlassPanel
          style={{
            width: wide ? 310 : undefined,
            backgroundColor: theme.colors.midnight,
            borderColor: "rgba(255, 184, 0, 0.3)",
            borderWidth: 1.5,
            gap: 16,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: "rgba(255, 184, 0, 0.15)",
              borderWidth: 1,
              borderColor: "rgba(255, 184, 0, 0.4)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sun size={26} color={theme.colors.gold} strokeWidth={2.4} />
          </View>

          <Text
            style={{
              fontSize: 23,
              fontWeight: "800",
              color: "#FFFFFF",
              lineHeight: 30,
              letterSpacing: -0.5,
            }}
          >
            Et si votre toit{"\n"}produisait votre énergie ?
          </Text>

          <Text style={{ color: "#94A3B8", fontSize: 14, lineHeight: 22 }}>
            Importez votre facture STEG et découvrez le dimensionnement optimal pour votre maison.
          </Text>

          <PremiumButton
            title="Analyser ma facture"
            onPress={() => router.push("/analyse")}
          />
        </GlassPanel>
      </View>
    </ResponsiveLayout>
  );
}
