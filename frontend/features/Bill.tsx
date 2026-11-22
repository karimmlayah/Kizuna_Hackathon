import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Sparkles, Edit3, ArrowRight, CheckCircle2, FileText, Zap } from "lucide-react-native";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { FileUpload, type LocalFile } from "../components/FileUpload";
import {
  GlassPanel,
  Title,
  Copy,
  StepIndicator,
  PremiumButton,
  Field,
  StatusIndicator,
  LoadingSkeleton,
  s,
  colors,
} from "../components/ui";
import { useSolarStore } from "../store/useSolarStore";
import { theme } from "../theme";

const TUNISIAN_GOVERNORATES = [
  "Tunis", "Ariana", "Ben Arous", "Manouba", "Nabeul", "Zaghouan", "Bizerte",
  "Béja", "Jendouba", "Le Kef", "Siliana", "Sousse", "Monastir", "Mahdia",
  "Sfax", "Kairouan", "Kasserine", "Sidi Bouzid", "Gabès", "Médenine",
  "Tataouine", "Gafsa", "Tozeur", "Kébili"
];

export default function Bill() {
  const router = useRouter();
  const { input, set } = useSolarStore();

  // Mode: "ai" (Scan document) vs "manual" (Direct input)
  const [mode, setMode] = useState<"ai" | "manual">("ai");

  // State for AI Mode
  const [file, setFile] = useState<LocalFile | null>(null);
  const [step, setStep] = useState(0);
  const [demo, setDemo] = useState(false);

  // Common Form Fields
  const [kwh, setKwh] = useState(input.annual ? String(Math.round(input.annual / 6)) : "400");
  const [months, setMonths] = useState("2");
  const [amount, setAmount] = useState("92");
  const [period, setPeriod] = useState("Facture de 2 mois");
  const [subscription, setSubscription] = useState("Résidentiel basse tension");
  const [location, setLocation] = useState(input.location || "Tunis");
  const [budget, setBudget] = useState("4500");
  const [error, setError] = useState("");

  // AI loading effect
  useEffect(() => {
    if (mode === "ai" && step === 1) {
      const timer = setTimeout(() => setStep(2), 1200);
      return () => clearTimeout(timer);
    }
  }, [step, mode]);

  const annualKwh = Number(kwh) > 0 && Number(months) > 0
    ? Math.round((Number(kwh) * 12) / Number(months))
    : 2400;

  function handleSaveAndContinue(targetRoute: string = "/dimensionnement") {
    if (
      !Number.isFinite(Number(kwh)) ||
      Number(kwh) <= 0 ||
      !Number.isFinite(Number(months)) ||
      Number(months) <= 0 ||
      Number(months) > 12 ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) < 0
    ) {
      setError("Veuillez vérifier la consommation, la période (1 à 12 mois) et le montant.");
      return;
    }

    set({
      input: {
        ...input,
        annual: annualKwh,
        location: location,
      },
    });

    router.push(targetRoute as any);
  }

  return (
    <ResponsiveLayout>
      {/* Header & Mode Switcher */}
      <View style={{ gap: 12, marginBottom: 24 }}>
        <StatusIndicator label="Module 01 · Analyse & Données Énergétiques" />
        <Title>Votre facture, point de départ de votre autonomie.</Title>
        <Copy>
          Choisissez votre méthode : lecture automatique de votre facture ou saisie directe de vos chiffres.
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
            maxWidth: 550,
            marginTop: 8,
          }}
        >
          <Pressable
            onPress={() => setMode("ai")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 16,
              backgroundColor: mode === "ai" ? "#FFB800" : "transparent",
            }}
          >
            <Sparkles size={16} color={mode === "ai" ? "#17212E" : "#8A7A6A"} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: mode === "ai" ? "#17212E" : "#8A7A6A",
              }}
            >
              Lecture automatique
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
            <Edit3 size={16} color={mode === "manual" ? "#17212E" : "#8A7A6A"} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: mode === "manual" ? "#17212E" : "#8A7A6A",
              }}
            >
              Mode Manuel (Saisie directe)
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ────────────────── MODE AUTOMATIQUE ────────────────── */}
      {mode === "ai" ? (
        <>
          <StepIndicator
            step={step}
            labels={["Importation", "Lecture", "Validation"]}
          />
          <GlassPanel style={{ maxWidth: 850 }}>
            {step === 0 ? (
              <>
                <FileUpload
                  file={file}
                  onFile={(f) => {
                    setFile(f);
                    setDemo(false);
                  }}
                />
                <View style={[s.row, { flexWrap: "wrap", marginTop: 15, gap: 10 }]}>
                  <PremiumButton
                    title="Lire ma facture"
                    disabled={!file}
                    onPress={() => setStep(1)}
                  />
                  <PremiumButton
                    title="Exemple de facture (400 kWh)"
                    secondary
                    onPress={() => {
                      setDemo(true);
                      setKwh("400");
                      setMonths("2");
                      setAmount("92");
                      setLocation("Metlaoui");
                      setStep(1);
                    }}
                  />
                  <PremiumButton
                    title="Basculer en saisie manuelle"
                    secondary
                    onPress={() => setMode("manual")}
                  />
                </View>
              </>
            ) : step === 1 ? (
              <View style={{ padding: 30, gap: 20 }}>
                <Title>Lecture de votre facture en cours...</Title>
                <LoadingSkeleton />
                <Copy>
                  {demo
                    ? "Chargement de la facture d'exemple (400 kWh pour 2 mois, 92 TND)."
                    : "Lecture automatique de votre facture en cours..."}
                </Copy>
              </View>
            ) : (
              <>
                <StatusIndicator
                  label={demo ? "Facture d'exemple chargée" : "Données lues sur votre facture"}
                />
                <Title>Vérifiez et validez vos données</Title>
                {file && <FileUpload file={file} onFile={setFile} />}

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
                  <View style={{ flex: 1, minWidth: 240 }}>
                    <Field
                      label="Consommation sur la période (kWh)"
                      value={kwh}
                      onChange={setKwh}
                      numeric
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 240 }}>
                    <Field
                      label="Nombre de mois facturés"
                      value={months}
                      onChange={setMonths}
                      numeric
                    />
                  </View>
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 240 }}>
                    <Field
                      label="Montant TTC (TND)"
                      value={amount}
                      onChange={setAmount}
                      numeric
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 240 }}>
                    <Field
                      label="Gouvernorat / Ville"
                      value={location}
                      onChange={setLocation}
                    />
                  </View>
                </View>

                {error ? (
                  <Text accessibilityRole="alert" style={{ color: "#A94436", fontWeight: "700" }}>
                    {error}
                  </Text>
                ) : null}

                {/* Real-time calculated annual metrics card */}
                <View
                  style={{
                    backgroundColor: "#FFF9ED",
                    borderWidth: 1.5,
                    borderColor: "#FFE29A",
                    borderRadius: 18,
                    padding: 16,
                    marginTop: 12,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#8A7A6A", textTransform: "uppercase" }}>
                    Projection Déterministe Annuelle
                  </Text>
                  <Text style={{ fontSize: 24, fontWeight: "900", color: "#17212E" }}>
                    {annualKwh.toLocaleString("fr-FR")} kWh / an
                  </Text>
                  <Text style={{ fontSize: 13, color: "#6A5E52" }}>
                    Soit environ {Math.round(annualKwh / 12)} kWh par mois pour {location}.
                  </Text>
                </View>

                <View style={[s.row, { flexWrap: "wrap", marginTop: 16, gap: 12 }]}>
                  <PremiumButton
                    title="Continuer vers le Dimensionnement"
                    onPress={() => handleSaveAndContinue("/dimensionnement")}
                  />
                  <PremiumButton
                    title="Aller directement au Studio Toiture"
                    secondary
                    onPress={() => handleSaveAndContinue("/studio")}
                  />
                  <PremiumButton
                    title="Réimporter"
                    secondary
                    onPress={() => setStep(0)}
                  />
                </View>
              </>
            )}
          </GlassPanel>
        </>
      ) : (
        /* ────────────────── MODE MANUEL ────────────────── */
        <GlassPanel style={{ maxWidth: 850 }}>
          <StatusIndicator label="Mode Manuel · Saisie directe autonome sans document" />
          <Title>Saisissez vos consommations directement</Title>
          <Copy>
            Aucune facture requise. Indiquez simplement votre consommation estimée ou vos dépenses d'électricité habituelles.
          </Copy>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 16 }}>
            <View style={{ flex: 1, minWidth: 240 }}>
              <Field
                label="Consommation en kWh"
                value={kwh}
                onChange={setKwh}
                numeric
              />
            </View>

            <View style={{ flex: 1, minWidth: 240 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#17212E", marginBottom: 6 }}>
                Période de cette consommation
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { label: "1 mois", val: "1" },
                  { label: "Tous les 2 mois", val: "2" },
                  { label: "12 mois (an)", val: "12" },
                ].map((item) => (
                  <Pressable
                    key={item.val}
                    onPress={() => setMonths(item.val)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      alignItems: "center",
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: months === item.val ? "#FFB800" : "#E2DDD3",
                      backgroundColor: months === item.val ? "#FFF9ED" : "#FFFFFF",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: months === item.val ? "#17212E" : "#8A7A6A",
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
            <View style={{ flex: 1, minWidth: 240 }}>
              <Field
                label="Montant estimé (TND)"
                value={amount}
                onChange={setAmount}
                numeric
              />
            </View>

            <View style={{ flex: 1, minWidth: 240 }}>
              <Field
                label="Gouvernorat ou ville"
                value={location}
                onChange={setLocation}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
            <View style={{ flex: 1, minWidth: 240 }}>
              <Field
                label="Budget indicatif (TND)"
                value={budget}
                onChange={setBudget}
                numeric
              />
            </View>
            <View style={{ flex: 1, minWidth: 240 }}>
              <Field
                label="Type de compteur"
                value={subscription}
                onChange={setSubscription}
              />
            </View>
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={{ color: "#A94436", fontWeight: "700", marginTop: 8 }}>
              {error}
            </Text>
          ) : null}

          {/* Real-time annual summary */}
          <View
            style={{
              backgroundColor: "#FFF9ED",
              borderWidth: 1.5,
              borderColor: "#FFE29A",
              borderRadius: 18,
              padding: 18,
              marginTop: 18,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#8A7A6A", textTransform: "uppercase" }}>
              Consommation Annuelle Calculée
            </Text>
            <Text style={{ fontSize: 32, fontWeight: "900", color: "#17212E" }}>
              {annualKwh.toLocaleString("fr-FR")} kWh
            </Text>
            <Text style={{ fontSize: 13, color: "#6A5E52" }}>
              Équivalent à {(annualKwh / 12).toFixed(1)} kWh/mois. Basé sur les tarifs résidentiels pour {location}.
            </Text>
          </View>

          {/* Actions & Direct Navigation */}
          <View style={[s.row, { flexWrap: "wrap", marginTop: 20, gap: 12 }]}>
            <PremiumButton
              title="Valider et Dimensionner"
              onPress={() => handleSaveAndContinue("/dimensionnement")}
            />
            <PremiumButton
              title="Aller directement au Studio Toiture"
              secondary
              onPress={() => handleSaveAndContinue("/studio")}
            />
            <PremiumButton
              title="Voir la Rentabilité Financière"
              secondary
              onPress={() => handleSaveAndContinue("/rentabilite")}
            />
          </View>
        </GlassPanel>
      )}
    </ResponsiveLayout>
  );
}
