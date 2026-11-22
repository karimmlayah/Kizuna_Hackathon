import React, { useState, useEffect } from "react";
import { View, Text, useWindowDimensions, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles, Sliders, ArrowRight, Sun, Compass, ShieldCheck } from "lucide-react-native";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import {
  GlassPanel,
  Title,
  Copy,
  Stepper,
  Field,
  PremiumButton,
  StatusIndicator,
  AnimatedCounter,
  s,
  colors,
} from "../components/ui";
import { useSolarStore } from "../store/useSolarStore";
import { sizeSolar } from "../utils/solar";
import { calculateSolarSizingApi, type SolarSizingResponse } from "../services/rooftopApi";
import SolarScene from "../scenes/SolarScene";
import { theme } from "../theme";

export default function Sizing() {
  const { input, set } = useSolarStore();
  const router = useRouter();
  const wide = useWindowDimensions().width > 1100;

  // Mode: "smart" (PVGIS & AI optimization) vs "manual" (Direct custom sliders)
  const [mode, setMode] = useState<"smart" | "manual">("smart");

  // Manual specific overrides
  const [manualPanelCount, setManualPanelCount] = useState<number>(6);
  const [manualWattage, setManualWattage] = useState<number>(input.watts || 450);
  const [manualTilt, setManualTilt] = useState<number>(31);
  const [manualOrientation, setManualOrientation] = useState<string>("Sud (0°)");
  const [manualLosses, setManualLosses] = useState<number>(14);

  // Backend live PVGIS sizing response
  const [backendSizing, setBackendSizing] = useState<SolarSizingResponse | null>(null);

  // Query backend sizing on input change
  useEffect(() => {
    let active = true;
    calculateSolarSizingApi({
      annualKwh: input.annual || 2400,
      location: input.location || "Tunis",
      panelWattageW: input.watts || 450,
      targetCoverage: 1.0,
    })
      .then((res) => {
        if (active) {
          setBackendSizing(res);
          if (mode === "smart") {
            setManualPanelCount(res.main_configuration.nb_panels);
          }
        }
      })
      .catch(() => {
        // Fallback to local deterministic calculation
      });

    return () => {
      active = false;
    };
  }, [input.annual, input.location, input.watts, mode]);

  // Fallback local sizing calculation
  const fallbackResult = sizeSolar(input.annual, input.area, input.watts);

  // Active configuration based on mode
  const activeKwp = mode === "smart"
    ? (backendSizing?.main_configuration.installed_kwp ?? fallbackResult.kwp)
    : Number(((manualPanelCount * manualWattage) / 1000).toFixed(2));

  const specificYield = backendSizing?.specific_yield_kwh_kwp || 1650;
  const orientationFactor = manualOrientation.includes("Sud") ? 1.0 : 0.88;
  const lossFactor = (100 - manualLosses) / 86; // normalized to 14% baseline

  const activeProduction = mode === "smart"
    ? (backendSizing?.main_configuration.estimated_production_kwh_year ?? fallbackResult.production)
    : Math.round(activeKwp * specificYield * orientationFactor * lossFactor);

  const activePanels = mode === "smart"
    ? (backendSizing?.main_configuration.nb_panels ?? fallbackResult.panels)
    : manualPanelCount;

  const coveragePct = Math.min(150, Math.round((activeProduction / (input.annual || 2400)) * 100));

  const update = (p: Partial<typeof input>) =>
    set({ input: { ...input, ...p } });

  return (
    <ResponsiveLayout>
      {/* Header & Mode Switcher */}
      <View style={{ gap: 10, marginBottom: 24 }}>
        <StatusIndicator label="Module 02 · Dimensionnement Solaire Intelligent" />
        <Title>Le potentiel solaire exact de votre toiture.</Title>
        <Copy>
          Optimisez votre puissance installée avec notre algorithme basé sur le cadastre solaire PVGIS ou ajustez manuellement chaque paramètre physique.
        </Copy>

        {/* Segmented Mode Selector */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#FFF9ED",
            borderWidth: 1.5,
            borderColor: "#FFE29A",
            borderRadius: 20,
            padding: 4,
            maxWidth: 600,
            marginTop: 8,
          }}
        >
          <Pressable
            onPress={() => setMode("smart")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 16,
              backgroundColor: mode === "smart" ? "#FFB800" : "transparent",
            }}
          >
            <Sparkles size={16} color={mode === "smart" ? "#17212E" : "#8A7A6A"} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: mode === "smart" ? "#17212E" : "#8A7A6A",
              }}
            >
              Mode Intelligent (PVGIS & Optimisé)
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setMode("manual")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 16,
              backgroundColor: mode === "manual" ? "#FFB800" : "transparent",
            }}
          >
            <Sliders size={16} color={mode === "manual" ? "#17212E" : "#8A7A6A"} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: mode === "manual" ? "#17212E" : "#8A7A6A",
              }}
            >
              Mode Manuel (Direct)
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        {/* Controls Column */}
        <GlassPanel style={{ width: wide ? 380 : undefined }}>
          {mode === "smart" ? (
            /* Controls: Mode Intelligent */
            <>
              <Stepper
                label="Consommation annuelle cible"
                value={input.annual}
                min={600}
                max={24000}
                step={300}
                unit="kWh"
                onChange={(annual) => update({ annual })}
              />
              <Field
                label="Gouvernorat ou ville"
                value={input.location}
                onChange={(location) => update({ location })}
              />
              <Stepper
                label="Surface de toiture estimée"
                value={input.area}
                min={0}
                max={300}
                step={5}
                unit="m²"
                onChange={(area) => update({ area })}
              />
              <Stepper
                label="Puissance unitaire du panneau"
                value={input.watts}
                min={350}
                max={600}
                step={25}
                unit="Wc"
                onChange={(watts) => update({ watts })}
              />

              <View
                style={{
                  backgroundColor: "#FFF9ED",
                  borderWidth: 1,
                  borderColor: "#FFE29A",
                  borderRadius: 14,
                  padding: 12,
                  marginTop: 10,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#8A7A6A", textTransform: "uppercase" }}>
                  Source Cadastre Solaire
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#17212E" }}>
                  {backendSizing?.yield_source || "PVGIS-5 / ANME Tunisie"}
                </Text>
                <Text style={{ fontSize: 12, color: "#6A5E52" }}>
                  Rendement spécifique : {specificYield} kWh/kWc/an à inclinaison optimale (~31°).
                </Text>
              </View>
            </>
          ) : (
            /* Controls: Mode Manuel */
            <>
              <Stepper
                label="Nombre de panneaux photovoltaïques"
                value={manualPanelCount}
                min={2}
                max={40}
                step={1}
                unit="modules"
                onChange={setManualPanelCount}
              />
              <Stepper
                label="Puissance nominale par panneau"
                value={manualWattage}
                min={300}
                max={650}
                step={25}
                unit="Wc"
                onChange={setManualWattage}
              />
              <Stepper
                label="Inclinaison du toit / structure"
                value={manualTilt}
                min={0}
                max={60}
                step={1}
                unit="°"
                onChange={setManualTilt}
              />

              <Text style={{ color: colors.midnight, fontWeight: "700", fontSize: 13, marginTop: 10 }}>
                Orientation de la toiture
              </Text>
              <View style={[s.row, { flexWrap: "wrap", gap: 8, marginTop: 6 }]}>
                {["Sud (0°)", "Sud-Est (-45°)", "Sud-Ouest (+45°)", "Est / Ouest"].map((orient) => (
                  <PremiumButton
                    key={orient}
                    title={orient}
                    secondary={manualOrientation !== orient}
                    onPress={() => setManualOrientation(orient)}
                  />
                ))}
              </View>

              <Stepper
                label="Pertes système estimées (onduleur, câblage)"
                value={manualLosses}
                min={8}
                max={25}
                step={1}
                unit="%"
                onChange={setManualLosses}
              />
            </>
          )}

          <View style={{ marginTop: 16 }}>
            <Copy>
              Calcul déterministe certifié Smart Solar sans aucune hallucination sur les chiffres.
            </Copy>
          </View>
        </GlassPanel>

        {/* 3D Scene & Live Performance Cards */}
        <View style={{ flex: 1, gap: 20 }}>
          <LinearGradient
            colors={["#FFF8EC", "#FFEFCF", "#FAF9F5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              height: 340,
              borderRadius: 26,
              borderWidth: 1.5,
              borderColor: "#FFE29A",
              overflow: "hidden",
            }}
          >
            <SolarScene night={false} />
          </LinearGradient>

          <GlassPanel>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.midnight }}>
                Bilan de Dimensionnement · {input.location || "Tunisie"}
              </Text>
              <StatusIndicator
                label={mode === "smart" ? "Algorithme Intelligent" : "Configuration Directe"}
              />
            </View>

            <View
              style={[
                s.row,
                { flexWrap: "wrap", justifyContent: "space-between", marginVertical: 14, gap: 12 },
              ]}
            >
              <View
                style={{
                  backgroundColor: "#FFF9ED",
                  borderWidth: 1.5,
                  borderColor: "#FFE29A",
                  padding: 16,
                  borderRadius: 18,
                  minWidth: 150,
                  flex: 1,
                }}
              >
                <AnimatedCounter value={activeKwp} suffix="kWc" />
                <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 13, marginTop: 4 }}>
                  {activePanels} panneaux de {mode === "smart" ? (input.watts || 450) : manualWattage} Wc
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: "#FFF9ED",
                  borderWidth: 1.5,
                  borderColor: "#FFE29A",
                  padding: 16,
                  borderRadius: 18,
                  minWidth: 150,
                  flex: 1,
                }}
              >
                <AnimatedCounter value={activeProduction} suffix="kWh/an" />
                <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 13, marginTop: 4 }}>
                  Taux de couverture : {coveragePct}%
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: "#FFF9ED",
                  borderWidth: 1.5,
                  borderColor: "#FFE29A",
                  padding: 16,
                  borderRadius: 18,
                  minWidth: 150,
                  flex: 1,
                }}
              >
                <AnimatedCounter value={Number((activePanels * 2.0).toFixed(1))} suffix="m²" />
                <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 13, marginTop: 4 }}>
                  Surface minimale requise
                </Text>
              </View>
            </View>

            <Copy>
              Passez directement au Studio pour implanter ces {activePanels} modules sur votre propre toit, ou simulez la rentabilité financière.
            </Copy>

            {/* Direct Navigation Buttons */}
            <View style={[s.row, { flexWrap: "wrap", marginTop: 14, gap: 12 }]}>
              <PremiumButton
                title="Implanter dans le Studio Toiture"
                onPress={() => router.push("/studio")}
              />
              <PremiumButton
                title="Calculer la Rentabilité Financière"
                secondary
                onPress={() => router.push("/rentabilite")}
              />
              <PremiumButton
                title="Discuter avec Solar AI"
                secondary
                onPress={() => router.push("/chat")}
              />
            </View>
          </GlassPanel>
        </View>
      </View>
    </ResponsiveLayout>
  );
}
