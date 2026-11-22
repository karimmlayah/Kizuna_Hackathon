import React, { useState } from "react";
import { View, Text, ScrollView, Image, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import {
  FileCheck,
  Zap,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Download,
} from "lucide-react-native";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import {
  GlassPanel,
  Title,
  Copy,
  StatusIndicator,
  PremiumButton,
  s,
  colors,
} from "../components/ui";
import { theme } from "../theme";
import { useSolarStore } from "../store/useSolarStore";

export default function InstallationReport() {
  const router = useRouter();
  const { input, rooftopPhoto, analysisResult, manualPanels, panelModel, savedProjects, set } =
    useSolarStore();

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Compute final specs
  const activePanels = manualPanels.length > 0
    ? manualPanels
    : (analysisResult?.primary_placement || []);

  const totalPanels = activePanels.length;
  const kwp = round2((totalPanels * (panelModel?.power_w || 400)) / 1000);
  const annualProdKwh = Math.round(kwp * 1650);
  const occupiedAreaM2 = round2(totalPanels * (panelModel?.width_m || 1.0) * (panelModel?.height_m || 1.7));
  const costTnd = Math.round(kwp * 2400);
  const savingsTnd = Math.round(annualProdKwh * 0.35);
  const roiYears = savingsTnd > 0 ? round2(costTnd / savingsTnd) : 0;
  const coveragePct = input.annual > 0 ? Math.min(100, Math.round((annualProdKwh / input.annual) * 100)) : 100;

  function round2(v: number) {
    return Math.round(v * 10) / 10;
  }

  function handleSaveProject() {
    const project = {
      id: String(Date.now()),
      name: `Installation ${input.location} — ${totalPanels} modules (${kwp} kWc)`,
      date: new Date().toLocaleDateString("fr-FR"),
      photoUri: rooftopPhoto || undefined,
      panelsCount: totalPanels,
      capacityKwp: kwp,
      annualKwh: annualProdKwh,
      costTnd,
      savingsTnd,
      roiYears,
      mode: (manualPanels.length > 0 ? "manual" : "ai") as "ai" | "manual",
      panels: activePanels,
    };

    set({ savedProjects: [project, ...(savedProjects || [])] });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  }

  return (
    <ResponsiveLayout>
      <View style={{ gap: 10, marginBottom: 24 }}>
        <Pressable
          onPress={() => router.push("/studio")}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}
        >
          <ArrowLeft size={16} color="#D97706" />
          <Text style={{ fontSize: 14, color: "#D97706", fontWeight: "600" }}>
            Retour au Solar Design Studio
          </Text>
        </Pressable>
        <StatusIndicator label="Rapport Officiel de Dimensionnement & Implantation" />
        <Title>Étude d'Implantation Photovoltaïque</Title>
        <Copy>
          Synthèse détaillée de votre projet solaire basée sur l'analyse de votre toiture et votre configuration personnalisée.
        </Copy>
      </View>

      {/* Top Banner Status */}
      <GlassPanel
        style={{
          backgroundColor: "#17212E",
          borderColor: "#FFE29A",
          borderWidth: 1.5,
          marginBottom: 24,
          padding: 24,
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <View style={{ gap: 6, flex: 1, minWidth: 240 }}>
          <Text style={{ fontSize: 13, color: "#FFB800", fontWeight: "700", letterSpacing: 1 }}>
            PROJET VALIDÉ POUR LE CLIENT
          </Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: "#FFFFFF" }}>
            {totalPanels} Panneaux Photovoltaïques · {kwp} kWc
          </Text>
          <Text style={{ fontSize: 14, color: "#94A3B8" }}>
            Localisation : {input.location} · Besoin annuel : {input.annual.toLocaleString("fr-FR")} kWh/an
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <PremiumButton
            title={savedSuccess ? "✓ Projet Enregistré" : "Enregistrer ce Projet"}
            onPress={handleSaveProject}
          />
        </View>
      </GlassPanel>

      {/* Key Metrics Grid */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <GlassPanel style={{ flex: 1, minWidth: 160, padding: 20 }}>
          <Zap size={24} color="#D97706" />
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 10 }}>Puissance crête</Text>
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.ink }}>{kwp} kWc</Text>
          <Text style={{ fontSize: 12, color: "#10B981", fontWeight: "600", marginTop: 4 }}>
            {panelModel?.name || "Modules 400W"}
          </Text>
        </GlassPanel>

        <GlassPanel style={{ flex: 1, minWidth: 160, padding: 20 }}>
          <TrendingUp size={24} color="#D97706" />
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 10 }}>Production estimée</Text>
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.ink }}>
            {annualProdKwh.toLocaleString("fr-FR")} kWh
          </Text>
          <Text style={{ fontSize: 12, color: "#D97706", fontWeight: "600", marginTop: 4 }}>
            {coveragePct}% du besoin annuel
          </Text>
        </GlassPanel>

        <GlassPanel style={{ flex: 1, minWidth: 160, padding: 20 }}>
          <DollarSign size={24} color="#D97706" />
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 10 }}>Investissement estimé</Text>
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.ink }}>
            {costTnd.toLocaleString("fr-FR")} TND
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Clé en main (TTC)</Text>
        </GlassPanel>

        <GlassPanel style={{ flex: 1, minWidth: 160, padding: 20 }}>
          <CheckCircle2 size={24} color="#10B981" />
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 10 }}>Économies / an</Text>
          <Text style={{ fontSize: 26, fontWeight: "800", color: "#10B981" }}>
            {savingsTnd.toLocaleString("fr-FR")} TND
          </Text>
          <Text style={{ fontSize: 12, color: "#D97706", fontWeight: "600", marginTop: 4 }}>
            Retour en ~{roiYears} ans
          </Text>
        </GlassPanel>
      </View>

      {/* Visual Rooftop Preview Card */}
      <GlassPanel style={{ marginBottom: 24, gap: 16 }}>
        <Title>Implantation sur la Toiture</Title>
        <Copy>
          Disposition validée avec respect des marges périphériques et des espacements de ventilation inter-modules.
        </Copy>

        <View
          style={{
            height: 280,
            borderRadius: 18,
            overflow: "hidden",
            backgroundColor: "#17212E",
            position: "relative",
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#FFE29A",
          }}
        >
          {rooftopPhoto ? (
            <Image
              source={{ uri: rooftopPhoto }}
              style={{ width: "100%", height: "100%", resizeMode: "cover" }}
            />
          ) : (
            <View style={{ alignItems: "center", gap: 10 }}>
              <Layers size={44} color="#FFB800" />
              <Text style={{ color: "#FFE29A", fontSize: 15, fontWeight: "600" }}>
                Toiture démonstration · {input.roof} ({input.area} m²)
              </Text>
            </View>
          )}

          {/* Overlay summary pill */}
          <View
            style={{
              position: "absolute",
              bottom: 14,
              left: 14,
              right: 14,
              backgroundColor: "rgba(23, 33, 46, 0.92)",
              borderRadius: 14,
              padding: 12,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(255, 184, 0, 0.3)",
            }}
          >
            <View>
              <Text style={{ color: "#FFB800", fontSize: 12, fontWeight: "700" }}>
                SURFACE OCCUPÉE
              </Text>
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>
                {occupiedAreaM2} m² sur {input.area} m² disponibles
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: "#FFE29A", fontSize: 12, fontWeight: "700" }}>
                DISPOSITION
              </Text>
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>
                {analysisResult?.metrics?.orientation === "portrait" ? "Portrait (Vertical)" : "Paysage (Horizontal)"}
              </Text>
            </View>
          </View>
        </View>
      </GlassPanel>

      {/* Technical Specifications Table */}
      <GlassPanel style={{ marginBottom: 24, gap: 16 }}>
        <Title>Spécifications Techniques & Matériel</Title>
        {[
          ["Modules sélectionnés", panelModel?.name || "400W Monocristallin PERC"],
          ["Nombre de capteurs", `${totalPanels} modules`],
          ["Dimensions unitaire", `${panelModel?.width_m || 1.0} m × ${panelModel?.height_m || 1.72} m`],
          ["Puissance unitaire", `${panelModel?.power_w || 400} Wc`],
          ["Type d'onduleur recommandé", `Onduleur hybride monophasé / triphasé ~${Math.ceil(kwp)} kVA`],
          ["Technologie de fixation", "Rails aluminium anodisé, ancrages étanches toiture terrasse"],
          ["Garantie constructeur panneaux", "25 ans de performance linéaire (84,8 % à 25 ans)"],
        ].map(([label, val], idx) => (
          <View
            key={label}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 10,
              borderBottomWidth: idx < 6 ? 1 : 0,
              borderColor: theme.colors.line,
            }}
          >
            <Text style={{ fontSize: 14, color: colors.muted }}>{label}</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}>{val}</Text>
          </View>
        ))}
      </GlassPanel>

      {/* Professional Recommendations & Limits */}
      <GlassPanel style={{ marginBottom: 30, gap: 14, backgroundColor: "#FFFDF9" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ShieldAlert size={22} color="#D97706" />
          <Title>Recommandations & Hypothèses de l'Étude</Title>
        </View>
        <Copy>
          • <strong>Audit structurel préalable :</strong> L'analyse numérique intelligente estime la surface géométrique exploitable. Un audit physique sur site par un installateur agréé est impératif pour vérifier la portance de la charpente et l'étanchéité de la dalle.
        </Copy>
        <Copy>
          • <strong>Ombrages et masques lointains :</strong> Les calculs de production considèrent une irradiation moyenne tunisienne de 1 650 kWh/kWc/an. Les ombrages d'arbres avoisinants ou de constructions futures peuvent impacter le rendement réel.
        </Copy>
        <Copy>
          • <strong>Raccordement réseau :</strong> Cette simulation financière est calculée sur la base d'un tarif résidentiel moyen de 0,35 TND/kWh en autoconsommation totale pour votre propre consommation d'énergie.
        </Copy>
      </GlassPanel>

      {/* Navigation Buttons */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 40 }}>
        <PremiumButton
          title="Modifier la disposition au Studio"
          secondary
          onPress={() => router.push("/studio")}
        />
        <PremiumButton
          title="Voir la Rentabilité Détaillée"
          secondary
          onPress={() => router.push("/rentabilite")}
        />
      </View>
    </ResponsiveLayout>
  );
}
