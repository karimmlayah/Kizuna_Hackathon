import React, { useState } from "react";
import { View, Text, Switch } from "react-native";
import { useRouter } from "expo-router";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import {
  GlassPanel,
  Title,
  Copy,
  Field,
  PremiumButton,
  StatusIndicator,
  s,
} from "../components/ui";
import { useSolarStore } from "../store/useSolarStore";
export default function Profile({ settings = false }: { settings?: boolean }) {
  const { name, input, night, reduced, set } = useSolarStore();
  const [draft, setDraft] = useState(name);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  return (
    <ResponsiveLayout>
      <View style={{ gap: 10, marginBottom: 28 }}>
        <StatusIndicator label="Préférences stockées sur cet appareil" />
        <Title>{settings ? "À votre façon." : "Votre espace solaire."}</Title>
        <Copy>Aucun compte requis. Aucune donnée envoyée à un serveur.</Copy>
      </View>
      <GlassPanel style={{ maxWidth: 700, gap: 20 }}>
        {settings ? (
          <>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={{ fontSize: 16, color: "#17212E", fontWeight: "500" }}>
                Ambiance nocturne du Digital Twin
              </Text>
              <Switch
                accessibilityLabel="Ambiance nocturne"
                value={night}
                onValueChange={(night) => set({ night })}
                trackColor={{ false: "#E2E8F0", true: "#FFB800" }}
                thumbColor={night ? "#FFF9ED" : "#FFFFFF"}
              />
            </View>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={{ fontSize: 16, color: "#17212E", fontWeight: "500" }}>
                Réduire les animations
              </Text>
              <Switch
                accessibilityLabel="Réduire les animations"
                value={reduced}
                onValueChange={(reduced) => set({ reduced })}
                trackColor={{ false: "#E2E8F0", true: "#FFB800" }}
                thumbColor={reduced ? "#FFF9ED" : "#FFFFFF"}
              />
            </View>
            <Copy>
              La préférence d’accessibilité du système est également respectée.
              Les fichiers sélectionnés sont temporaires et peuvent devoir être
              importés à nouveau au prochain lancement.
            </Copy>
            <PremiumButton
              title="Revoir la découverte"
              secondary
              onPress={() => router.push("/onboarding")}
            />
            <PremiumButton
              title="Accéder au Solar Design Studio"
              secondary
              onPress={() => router.push("/studio")}
            />
          </>
        ) : (
          <>
            <Field
              label="Votre prénom"
              value={draft}
              onChange={(v) => {
                setDraft(v);
                setSaved(false);
              }}
            />
            <PremiumButton
              title="Enregistrer"
              disabled={!draft.trim()}
              onPress={() => {
                set({ name: draft.trim().slice(0, 40) });
                setSaved(true);
              }}
            />
            {saved && (
              <Text accessibilityRole="alert" style={{ color: "#10B981", fontWeight: "600", marginTop: 4 }}>
                ✓ Préférences enregistrées.
              </Text>
            )}
            <Copy>
              Votre projet : {input.location} ·{" "}
              {input.annual.toLocaleString("fr-FR")} kWh/an · {input.area} m²
              disponibles.
            </Copy>
            <PremiumButton
              title="Modifier mon installation"
              secondary
              onPress={() => router.push("/dimensionnement")}
            />
            <PremiumButton
              title="Préférences de l’application"
              secondary
              onPress={() => router.push("/parametres")}
            />
          </>
        )}
      </GlassPanel>
    </ResponsiveLayout>
  );
}
