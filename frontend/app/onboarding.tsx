import React, { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Logo,
  Copy,
  PremiumButton,
  StepIndicator,
  s,
  colors,
} from "../components/ui";
import SolarScene from "../scenes/SolarScene";
import { useSolarStore } from "../store/useSolarStore";
import { theme } from "../theme";

const slides = [
  [
    "Découvrez votre potentiel solaire.",
    "Votre toit peut transformer votre autonomie. Explorez une nouvelle manière intelligente et durable de produire votre propre énergie.",
  ],
  [
    "Concevez votre installation sur-mesure.",
    "Ajustez vos paramètres, placez vos modules photovoltaïques et visualisez immédiatement l'impact architectural sur votre toiture.",
  ],
  [
    "Maîtrisez votre énergie et vos économies.",
    "Suivez vos flux en direct, anticipez votre rentabilité à 25 ans et optimisez chaque rayon de soleil au quotidien.",
  ],
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const set = useSolarStore((s) => s.set);

  function finish() {
    set({ onboarded: true });
    router.replace("/dashboard");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <LinearGradient
        colors={["#FFFDF7", "#FFF5E0", "#FAF9F5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, padding: 24, alignItems: "center" }}
      >
        <View
          style={[s.row, { width: "100%", justifyContent: "space-between" }]}
        >
          <Logo />
          <PremiumButton title="Accéder à la démo" secondary onPress={finish} />
        </View>

        <View
          style={{ flex: 1, width: "100%", maxWidth: 750, minHeight: 220 }}
          key={step}
        >
          <SolarScene night={step === 2} />
        </View>

        <View
          style={{ maxWidth: 600, width: "100%", gap: 20, paddingBottom: 20 }}
        >
          <StepIndicator
            step={step}
            labels={["Découvrir", "Concevoir", "Maîtriser"]}
          />

          <Text
            style={{
              fontSize: 34,
              lineHeight: 40,
              letterSpacing: -1,
              color: colors.midnight,
              fontWeight: "800",
            }}
          >
            {slides[step]?.[0]}
          </Text>

          <Copy>{slides[step]?.[1]}</Copy>

          <View style={[s.row, { justifyContent: "space-between", marginTop: 8 }]}>
            {step > 0 ? (
              <PremiumButton
                title="Précédent"
                secondary
                onPress={() => setStep(step - 1)}
              />
            ) : (
              <View />
            )}
            <PremiumButton
              title={step === 2 ? "Entrer dans ma maison" : "Continuer"}
              onPress={() => (step === 2 ? finish() : setStep(step + 1))}
            />
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}
