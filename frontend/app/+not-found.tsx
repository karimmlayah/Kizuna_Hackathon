import { View } from "react-native";
import { useRouter } from "expo-router";
import { Title, Copy, PremiumButton } from "../components/ui";
export default function NotFound() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, padding: 40, justifyContent: "center", gap: 20 }}>
      <Title>Ce chemin ne mène pas au soleil.</Title>
      <Copy>Cette page n’existe pas. Retrouvez votre espace énergie.</Copy>
      <PremiumButton
        title="Revenir à l’accueil"
        onPress={() => router.replace("/dashboard")}
      />
    </View>
  );
}
