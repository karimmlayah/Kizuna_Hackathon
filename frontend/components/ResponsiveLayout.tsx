import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useRouter, usePathname, type Href } from "expo-router";
import {
  LayoutDashboard,
  FileText,
  SlidersHorizontal,
  PanelsTopLeft,
  ChartNoAxesCombined,
  ShieldCheck,
  User,
  Settings,
  Sun,
  LogOut,
  Sparkles,
  Activity,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo, colors, s } from "./ui";
import { theme } from "../theme";

const routes = [
  ["Vue d’ensemble", "/dashboard", LayoutDashboard],
  ["Smart Energy Monitoring", "/monitoring", Activity],
  ["Solar AI", "/chat", Sparkles],
  ["Analyse de facture", "/analyse", FileText],
  ["Dimensionnement", "/dimensionnement", SlidersHorizontal],
  ["Solar Design Studio", "/studio", PanelsTopLeft],
  ["Rentabilité", "/rentabilite", ChartNoAxesCombined],
  ["Profil", "/profil", User],
  ["Paramètres", "/parametres", Settings],
] as const;

export function ResponsiveLayout({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const wide = width >= 1050;
  const router = useRouter();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const bottom = [routes[0], routes[1], routes[2], routes[4], routes[5]];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        flexDirection: "row",
        paddingTop: insets.top,
      }}
    >
      {wide && (
        <View
          style={{
            width: 252,
            backgroundColor: "#FFFFFF",
            borderRightWidth: 1,
            borderColor: theme.colors.line,
            padding: 24,
            gap: 32,
          }}
        >
          <Pressable accessibilityRole="link" onPress={() => router.push("/")}>
            <Logo />
          </Pressable>

          <View>
            <Text
              style={{
                fontSize: 11,
                letterSpacing: 2,
                fontWeight: "700",
                color: "#94A3B8",
                marginBottom: 16,
              }}
            >
              MON ESPACE SOLAIRE
            </Text>
            {routes.map(([label, href, Icon]) => {
              const active = path === href;
              return (
                <Pressable
                  key={href}
                  accessibilityRole="link"
                  onPress={() => router.push(href)}
                  style={[
                    s.row,
                    {
                      padding: 12,
                      paddingHorizontal: 12,
                      marginBottom: 6,
                      borderRadius: 14,
                      backgroundColor: active ? "#FEF3C7" : "transparent",
                      borderLeftWidth: active ? 3 : 0,
                      borderLeftColor: theme.colors.gold,
                    },
                  ]}
                >
                  <Icon
                    size={19}
                    color={active ? "#D97706" : colors.muted}
                    strokeWidth={active ? 2.4 : 1.9}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: active ? "700" : "500",
                      color: active ? colors.midnight : colors.muted,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flex: 1 }} />

          <View
            style={{
              backgroundColor: "#FFF9ED",
              borderWidth: 1.5,
              borderColor: "#FFE29A",
              padding: 18,
              borderRadius: 20,
              gap: 10,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: "rgba(255, 184, 0, 0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sun size={22} color="#D97706" />
            </View>
            <Text style={{ fontWeight: "800", color: colors.midnight, fontSize: 14, lineHeight: 20 }}>
              L’énergie de demain.{"\n"}Chez vous, aujourd’hui.
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}>
              Autonomie, rentabilité et élégance architecturale.
            </Text>
          </View>

          <Pressable onPress={() => router.push("/")} style={s.row}>
            <LogOut size={17} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500" }}>
              Découvrir Smart Solar
            </Text>
          </Pressable>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            padding: wide ? 36 : 18,
            paddingBottom: wide ? 36 : 110,
            maxWidth: 1700,
            width: "100%",
            alignSelf: "center",
          }}
        >
          {!wide && (
            <View
              style={[
                s.row,
                { justifyContent: "space-between", marginBottom: 20 },
              ]}
            >
              <Pressable onPress={() => router.push("/")}>
                <Logo />
              </Pressable>
              <Pressable
                accessibilityLabel="Paramètres"
                onPress={() => router.push("/parametres")}
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
                <Settings size={20} color={colors.midnight} />
              </Pressable>
            </View>
          )}

          {!wide && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 18 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {routes.slice(2, 5).map(([label, href]) => {
                const active = path === href;
                return (
                  <Pressable
                    key={href}
                    onPress={() => router.push(href)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      backgroundColor: active ? theme.colors.gold : "#FFF9ED",
                      borderWidth: 1,
                      borderColor: active ? theme.colors.sunset : "#FFE29A",
                      borderRadius: 14,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: active ? "#FFFFFF" : colors.midnight,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {children}
        </ScrollView>

        {!wide && (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              flexDirection: "row",
              backgroundColor: "rgba(255, 255, 255, 0.96)",
              paddingTop: 10,
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopWidth: 1,
              borderColor: theme.colors.line,
              shadowColor: "#FFB800",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            {bottom.map(([label, href, Icon], i) => {
              const active = path === href;
              return (
                <Pressable
                  key={href}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => router.push(href as Href)}
                  style={{ flex: 1, alignItems: "center", gap: 4 }}
                >
                  <View
                    style={{
                      backgroundColor: active ? "#FEF3C7" : "transparent",
                      borderWidth: active ? 1 : 0,
                      borderColor: "#FDE68A",
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 5,
                    }}
                  >
                    <Icon
                      size={20}
                      color={active ? "#D97706" : colors.muted}
                      strokeWidth={active ? 2.4 : 1.8}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: active ? "700" : "500",
                      color: active ? "#92400E" : colors.muted,
                    }}
                  >
                    {
                      [
                        "Accueil",
                        "Solar AI",
                        "Installation",
                        "Studio",
                        "Profil",
                      ][i]
                    }
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Floating Action Button (FAB) for Solar AI (visible on all pages except /chat) */}
        {path !== "/chat" ? (
          <Pressable
            accessibilityLabel="Ouvrir Solar AI"
            accessibilityRole="button"
            onPress={() => router.push("/chat")}
            style={{
              position: "absolute",
              bottom: wide ? 28 : Math.max(insets.bottom, 12) + 64,
              right: 20,
              zIndex: 99,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#17212E",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 24,
              borderWidth: 1.5,
              borderColor: "#FFB800",
              shadowColor: "#FFB800",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 8,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 8,
                backgroundColor: "#FFB800",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={14} color="#17212E" strokeWidth={2.5} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.3 }}>
              Solar AI
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
