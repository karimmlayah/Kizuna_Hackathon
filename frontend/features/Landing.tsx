import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Platform,
  type ScrollViewInstance,
} from "react-native";
import { useRouter, Redirect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Sun,
  ShieldCheck,
  ScanLine,
  PanelsTopLeft,
  ChartNoAxesCombined,
  ChevronDown,
  Leaf,
  Smartphone,
  Menu,
  Activity,
} from "lucide-react-native";
import {
  Logo,
  PremiumButton,
  StatusIndicator,
  GlassPanel,
  Title,
  Copy,
  colors,
  s,
} from "../components/ui";
import { theme } from "../theme";
import SolarScene from "../scenes/SolarScene";
import { useSolarStore } from "../store/useSolarStore";
import {useHydrated} from '../hooks/useHydrated';
const questions = [
  [
    "Est-ce connecté à mon installation ?",
    "Pas encore. Cette version de hackathon utilise des données de démonstration. Aucun compteur, équipement IoT ou service externe n’est connecté.",
  ],
  [
    "Comment estimez-vous mon potentiel ?",
    "À partir de votre consommation et de la surface renseignées, avec une hypothèse explicite de 1 650 kWh/kWc/an. Une étude professionnelle devra confirmer les résultats.",
  ],
  [
    "Mes factures sont-elles envoyées à un serveur ?",
    "Non. Les documents sont ouverts localement. Vous saisissez et validez les informations ; aucune reconnaissance OCR ou analyse IA n’est exécutée.",
  ],
  [
    "Puis-je utiliser Smart Solar sur Android ?",
    "La même application est conçue avec Expo pour le Web et Android. Le projet inclut la configuration EAS pour produire un APK. La visualisation native utilise une scène isométrique légère.",
  ],
];
export default function Landing() {
  const hydrated=useHydrated();
  const router = useRouter();
  const onboarded = useSolarStore((s) => s.onboarded);
  const { width } = useWindowDimensions();
  const wide = width > 850;
  const [open, setOpen] = useState<number | null>(0);
  const [menu, setMenu] = useState(false);
  const scroll = React.useRef<ScrollViewInstance>(null);
  const [faqY, setFaqY] = useState(0);
  if (Platform.OS !== "web" && !hydrated) return <View style={{flex:1,backgroundColor:theme.colors.midnight}}/>;
  if (Platform.OS !== "web")
    return <Redirect href={onboarded ? "/dashboard" : "/onboarding"} />;
  return (
    <ScrollView
      ref={scroll}
      style={{ backgroundColor: "#FAFCF8" }}
      contentContainerStyle={{ alignItems: "center" }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 1440,
          paddingHorizontal: wide ? 64 : 24,
        }}
      >
        <View style={[s.row, { height: 100, justifyContent: "space-between" }]}>
          <Logo />
          {wide ? (
            <View style={[s.row, { gap: 30 }]}>
              <Pressable onPress={() => router.push("/dimensionnement")}>
                <Text style={{ fontSize: 14, color: colors.muted }}>
                  Votre potentiel
                </Text>
              </Pressable>
              <Pressable onPress={() => router.push("/studio")}>
                <Text style={{ fontSize: 14, color: colors.muted }}>
                  Design Studio
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  scroll.current?.scrollTo({ y: faqY, animated: true })
                }
              >
                <Text style={{ fontSize: 14, color: colors.muted }}>
                  Questions fréquentes
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityLabel="Ouvrir le menu"
              onPress={() => setMenu(!menu)}
            >
              <Menu size={24} />
            </Pressable>
          )}
          {wide && (
            <PremiumButton
              title="Ouvrir la démo"
              secondary
              onPress={() => router.push("/dashboard")}
            />
          )}
        </View>
        {menu && (
          <View style={{ gap: 12, marginBottom: 24 }}>
            <PremiumButton
              title="Votre potentiel"
              secondary
              onPress={() => router.push("/dimensionnement")}
            />
            <PremiumButton
              title="Design Studio"
              secondary
              onPress={() => router.push("/studio")}
            />
            <PremiumButton
              title="Questions fréquentes"
              secondary
              onPress={() =>
                scroll.current?.scrollTo({ y: faqY, animated: true })
              }
            />
          </View>
        )}
        <View
          style={{
            flexDirection: wide ? "row" : "column",
            alignItems: wide ? "center" : undefined,
            paddingTop: wide ? 65 : 32,
            paddingBottom: 50,
            gap: wide ? 0 : 28,
          }}
        >
          <View style={{ width: wide ? "46%" : "100%", gap: 25, zIndex: 1 }}>
            <StatusIndicator label="L’énergie solaire, simplement." />
            <Text
              style={{
                fontSize: wide ? 68 : 46,
                lineHeight: wide ? 74 : 52,
                fontWeight: "800",
                letterSpacing: -2.5,
                color: colors.ink,
              }}
            >
              Le soleil est à vous.{"\n"}
              <Text style={{ color: "#D97706" }}>L’avenir aussi.</Text>
            </Text>
            <Text
              style={{
                fontSize: 18,
                lineHeight: 29,
                color: colors.muted,
                maxWidth: 460,
              }}
            >
              Imaginez une maison qui produit son énergie. Concevez votre
              installation et découvrez tout le potentiel de votre toit.
            </Text>
            <View style={{ alignItems: "flex-start", gap: 13 }}>
              <PremiumButton
                title="Estimer mon potentiel solaire"
                onPress={() => router.push("/analyse")}
              />
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push("/dashboard")}
                style={{ paddingVertical: 10 }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: colors.midnight,
                    borderBottomWidth: 1.5,
                    borderColor: theme.colors.gold,
                    paddingBottom: 4,
                  }}
                >
                  Découvrir la démonstration
                </Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "500" }}>
              Pensé pour la Tunisie · Sans inscription · Démonstration gratuite
            </Text>
          </View>
          <View
            style={{
              width: wide ? "58%" : "100%",
              height: wide ? 530 : 360,
              marginLeft: wide ? "-4%" : 0,
            }}
          >
            <LinearGradient
              colors={["#FFF8EC", "#FFEFCF", "#FAF9F5"]}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: wide ? 180 : 90,
              }}
            />
            <View
              style={{
                position: "absolute",
                width: 140,
                height: 140,
                borderRadius: 70,
                backgroundColor: "rgba(255, 184, 0, 0.28)",
                right: 70,
                top: 30,
              }}
            />
            <SolarScene night={false} />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 40,
                left: 20,
                backgroundColor: "rgba(255, 255, 255, 0.94)",
                borderWidth: 1.5,
                borderColor: "#FFE29A",
                padding: 16,
                borderRadius: 20,
                gap: 5,
                shadowColor: "#FFB800",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 16,
              }}
            >
              <View style={s.row}>
                <Sun size={18} color="#D97706" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>
                  Votre toit a du potentiel
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 26,
                  color: colors.midnight,
                  fontWeight: "800",
                  letterSpacing: -0.5,
                }}
              >
                100 %{" "}
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#D97706" }}>
                  d’énergie à imaginer
                </Text>
              </Text>
            </View>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: 15,
                right: 15,
                backgroundColor: theme.colors.midnight,
                borderWidth: 1.5,
                borderColor: "rgba(255, 184, 0, 0.35)",
                padding: 17,
                borderRadius: 20,
                gap: 5,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
              }}
            >
              <Text style={{ color: theme.colors.amberLight, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>
                VOTRE DIGITAL TWIN
              </Text>
              <Text style={{ color: "white", fontSize: 15, fontWeight: "700" }}>
                Une nouvelle vision de l’énergie.
              </Text>
            </View>
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 24,
            paddingVertical: 28,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: theme.colors.line,
          }}
        >
          {[
            [Sun, "Produisez votre énergie"],
            [Leaf, "Réduisez votre empreinte"],
            [ShieldCheck, "Gardez le contrôle"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Sun;
            return (
              <View key={String(label)} style={s.row}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: "#FFF9ED",
                    borderWidth: 1,
                    borderColor: "#FFE29A",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <I size={20} color="#D97706" strokeWidth={2.4} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.midnight }}>
                  {String(label)}
                </Text>
              </View>
            );
          })}
        </View>
        <View
          style={{
            paddingVertical: 80,
            flexDirection: wide ? "row" : "column",
            gap: 35,
          }}
        >
          <View style={{ flex: 1, gap: 18 }}>
            <Text
              style={{ fontSize: 12, letterSpacing: 2, color: colors.muted }}
            >
              MOINS D’INCERTITUDE. PLUS D’AUTONOMIE.
            </Text>
            <Text
              style={{
                fontSize: wide ? 42 : 34,
                lineHeight: 48,
                letterSpacing: -1.5,
                color: colors.ink,
                fontWeight: "500",
              }}
            >
              Votre facture monte.{"\n"}Votre regard aussi.
            </Text>
          </View>
          <View style={{ flex: 1, gap: 20, paddingTop: 20 }}>
            <Copy>
              Et si la réponse se trouvait juste au-dessus de vous ? Smart Solar
              rend votre projet photovoltaïque visible, compréhensible et
              personnel.
            </Copy>
            <Copy>
              De la première facture au dernier panneau, explorez chaque
              décision dans un seul espace. Avec des hypothèses claires, et la
              liberté d’ajuster.
            </Copy>
          </View>
        </View>
        <LinearGradient
          colors={["#17212E", "#0B111A"]}
          style={{
            padding: wide ? 44 : 25,
            borderRadius: 30,
            gap: 30,
            borderWidth: 1.5,
            borderColor: "rgba(255, 184, 0, 0.3)",
          }}
        >
          <View style={{ gap: 12 }}>
            <Text style={{ color: theme.colors.amberLight, fontSize: 12, fontWeight: "700", letterSpacing: 2 }}>
              DE L’IDÉE À VOTRE INSTALLATION
            </Text>
            <Text
              style={{
                fontSize: wide ? 38 : 30,
                color: "white",
                fontWeight: "800",
                letterSpacing: -1,
              }}
            >
              Tout commence par votre maison.
            </Text>
          </View>
          <View style={{ flexDirection: wide ? "row" : "column", gap: 26 }}>
            {[
              {
                I: ScanLine,
                title: "Comprenez",
                copy: "Importez votre facture STEG et validez votre consommation.",
                href: "/analyse",
              },
              {
                I: PanelsTopLeft,
                title: "Concevez",
                copy: "Dimensionnez votre projet et composez votre toiture.",
                href: "/studio",
              },
              {
                I: ChartNoAxesCombined,
                title: "Projetez-vous",
                copy: "Explorez vos économies et votre horizon sur 25 ans.",
                href: "/rentabilite",
              },
              {
                I: Activity,
                title: "Suivez en Live",
                copy: "Télémétrie ESP32 temps réel, alertes et prédictions.",
                href: "/monitoring",
              },
            ].map(({ I, title, copy, href }) => (
              <Pressable
                key={title}
                onPress={() => router.push(href as any)}
                style={{
                  flex: 1,
                  gap: 16,
                  padding: 22,
                  borderWidth: 1,
                  borderColor: "rgba(255, 184, 0, 0.2)",
                  borderRadius: 20,
                  backgroundColor: "rgba(255, 255, 255, 0.04)",
                }}
              >
                <I size={27} color={theme.colors.gold} strokeWidth={2.4} />
                <Text style={{ color: "white", fontSize: 23, fontWeight: "800" }}>{title}</Text>
                <Text
                  style={{ color: "#94A3B8", fontSize: 15, lineHeight: 24 }}
                >
                  {copy}
                </Text>
                <Text style={{ color: theme.colors.gold, fontSize: 13, fontWeight: "700" }}>
                  Explorer le module →
                </Text>
              </Pressable>
            ))}
          </View>
        </LinearGradient>
        <View
          style={{
            paddingVertical: 80,
            flexDirection: wide ? "row" : "column",
            alignItems: "center",
            gap: 60,
          }}
        >
          <View style={{ flex: 1, gap: 23 }}>
            <StatusIndicator label="Votre maison vous accompagne" />
            <Title>Une énergie qui tient dans la main.</Title>
            <Copy>
              Le même espace sur votre ordinateur et votre téléphone. Votre
              maison solaire, vos scénarios et votre studio de toiture IA, où
              que vous soyez.
            </Copy>
            <View style={s.row}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: "#FFF9ED",
                  borderWidth: 1,
                  borderColor: "#FFE29A",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Smartphone size={22} color="#D97706" />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.midnight }}>
                Une expérience Web et mobile native cohérente
              </Text>
            </View>
            <PremiumButton
              title="Découvrir l’expérience"
              secondary
              onPress={() => router.push("/onboarding")}
            />
            <PremiumButton
              title="Explorer le Studio Toiture"
              secondary
              onPress={() => router.push("/studio")}
            />
          </View>
          <View
            style={{
              width: 270,
              height: 460,
              backgroundColor: "#FFFDF9",
              borderWidth: 7,
              borderColor: theme.colors.midnight,
              borderRadius: 40,
              padding: 16,
              overflow: "hidden",
              shadowColor: "#FFB800",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
            }}
          >
            <View
              style={{
                width: 70,
                height: 15,
                backgroundColor: theme.colors.midnight,
                alignSelf: "center",
                borderRadius: 12,
                marginTop: -10,
                marginBottom: 25,
              }}
            />
            <Logo />
            <Text
              style={{
                fontSize: 22,
                color: colors.midnight,
                fontWeight: "800",
                marginTop: 22,
              }}
            >
              Bonjour, Amine.
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 7 }}>
              Une belle journée pour produire.
            </Text>
            <View style={{ height: 210, marginHorizontal: -25 }}>
              <SolarScene night={false} />
            </View>
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 15,
                padding: 16,
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>
                Économies illustratives
              </Text>
              <Text style={{ fontSize: 28, fontWeight: "800", color: "#D97706" }}>
                186 <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted }}>TND / mois</Text>
              </Text>
            </View>
          </View>
        </View>
        <View
          onLayout={(e) => setFaqY(e.nativeEvent.layout.y)}
          style={{ paddingVertical: 30, paddingBottom: 70, gap: 28 }}
        >
          <Title>Le solaire, en toute clarté.</Title>
          {questions.map(([q, a], i) => (
            <Pressable
              key={q}
              accessibilityRole="button"
              accessibilityState={{ expanded: open === i }}
              onPress={() => setOpen(open === i ? null : i)}
              style={{
                paddingVertical: 20,
                borderBottomWidth: 1,
                borderColor: theme.colors.line,
                gap: 16,
              }}
            >
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <Text style={{ fontSize: 17, fontWeight: "700", color: colors.ink, flex: 1 }}>
                  {q}
                </Text>
                <ChevronDown size={20} color="#D97706" />
              </View>
              {open === i && <Copy>{a}</Copy>}
            </Pressable>
          ))}
        </View>
        <View
          style={{
            paddingVertical: 34,
            borderTopWidth: 1,
            borderColor: theme.colors.line,
            gap: 25,
          }}
        >
          <View
            style={[
              s.row,
              { justifyContent: "space-between", flexWrap: "wrap" },
            ]}
          >
            <Logo />
            <Text style={{ fontSize: 13, color: colors.muted }}>
              Conçu pour un avenir solaire et lumineux.
            </Text>
            <Pressable onPress={() => router.push("/parametres")}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.midnight }}>
                Confidentialité & préférences
              </Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 11, lineHeight: 19, color: colors.muted }}>
            © 2026 Smart Solar · Démonstration photovoltaïque interactive. Toutes les mesures
            énergétiques sont illustratives. Les estimations locales ne
            remplacent pas une étude photovoltaïque professionnelle.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
