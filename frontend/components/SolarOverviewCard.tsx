import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Modal,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import {
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudRain,
  Wind,
  Thermometer,
  Zap,
  Gauge,
  MapPin,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  Clock,
  Layers,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  fetchSolarOverview,
  type SolarOverviewData,
} from "../services/weatherApi";
import { colors } from "./ui";
import { theme } from "../theme";

const CITIES = [
  { name: "Tunis", lat: 36.8065, lon: 10.1815 },
  { name: "Métlaoui", lat: 34.3208, lon: 8.4019 },
  { name: "Sousse", lat: 35.8256, lon: 10.6084 },
  { name: "Sfax", lat: 34.7406, lon: 10.7603 },
  { name: "Gafsa", lat: 34.425, lon: 8.7842 },
  { name: "Bizerte", lat: 37.2744, lon: 9.8739 },
  { name: "Nabeul", lat: 36.4561, lon: 10.7376 },
  { name: "Kairouan", lat: 35.6781, lon: 10.0963 },
  { name: "Djerba", lat: 33.8076, lon: 10.8451 },
  { name: "Tozeur", lat: 33.9197, lon: 8.1335 },
];

export function SolarOverviewCard({
  iotPowerW,
  iotConnected,
}: {
  iotPowerW?: number;
  iotConnected?: boolean;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [selectedCity, setSelectedCity] = useState("Tunis");
  const [coords, setCoords] = useState<{ lat?: number; lon?: number }>({ lat: 36.8065, lon: 10.1815 });
  const [overview, setOverview] = useState<SolarOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locSource, setLocSource] = useState<"city" | "gps" | "installation">("city");

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSolarOverview({
        lat: coords.lat,
        lon: coords.lon,
        city: selectedCity,
        kwp: 3.0,
      });
      setOverview(data);
    } catch (e) {
      console.warn("Échec chargement Solar Overview:", e);
    } finally {
      setLoading(false);
    }
  }, [coords.lat, coords.lon, selectedCity]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Request GPS Geolocation via Expo Location
  const requestCurrentLocation = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("Permission de géolocalisation refusée. Vous pouvez sélectionner votre ville manuellement.");
        setIsLocating(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      setSelectedCity("Position Actuelle (GPS)");
      setLocSource("gps");
      setIsCityModalOpen(false);
    } catch (err) {
      alert("Impossible de récupérer la position GPS. Sélection manuelle activée.");
    } finally {
      setIsLocating(false);
    }
  };

  const handleSelectCity = (c: (typeof CITIES)[0]) => {
    setSelectedCity(c.name);
    setCoords({ lat: c.lat, lon: c.lon });
    setLocSource("city");
    setIsCityModalOpen(false);
  };

  const handleSelectInstallation = () => {
    // Default installation location: Métlaoui
    const met = CITIES.find((c) => c.name === "Métlaoui") || CITIES[0];
    if (met) {
      setSelectedCity("Mon Installation (Métlaoui)");
      setCoords({ lat: met.lat, lon: met.lon });
      setLocSource("installation");
      setIsCityModalOpen(false);
    }
  };

  const weather = overview?.weather;
  const score = overview?.solar_score;
  const pv = overview?.pv_forecast;
  const isNight = weather?.is_night ?? false;

  // Weather Card Gradient Theme
  const cardGradient: [string, string] = isNight
    ? ["#17212E", "#0B111A"]
    : weather?.cloud_cover_pct && weather.cloud_cover_pct > 60
    ? ["#F1F5F9", "#E2E8F0"]
    : ["#FFF8EC", "#FFEFCF"];

  // Solar Score Ring Color
  const scoreColor =
    (score?.score ?? 0) >= 80
      ? "#10B981"
      : (score?.score ?? 0) >= 50
      ? "#F59E0B"
      : "#EF4444";

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 24,
        borderWidth: 1.5,
        borderColor: "#FFE29A",
        gap: 20,
        shadowColor: "#FFB800",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 3,
        marginBottom: 24,
      }}
    >
      {/* ───────────────────────────────────────────────────────────────── */}
      {/* Header: Greeting, City Selector & Refresh Button                  */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} color={theme.colors.gold} />
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#92400E", letterSpacing: 1.2 }}>
              TODAY'S SOLAR OVERVIEW · MÉTÉO & POTENTIEL EN TEMPS RÉEL
            </Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: "900", color: colors.midnight }}>
            {overview?.greeting || "Bonjour"}, voici votre ciel aujourd'hui.
          </Text>
        </View>

        {/* Location Button & Picker */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={() => setIsCityModalOpen(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#FFF9ED",
              borderWidth: 1.5,
              borderColor: "#FFE29A",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 18,
            }}
          >
            <MapPin size={16} color="#D97706" />
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#B45309" }}>
              {selectedCity}
            </Text>
            <ChevronDown size={14} color="#D97706" />
          </Pressable>

          <Pressable
            onPress={loadOverview}
            style={{
              backgroundColor: "#F8FAFC",
              borderWidth: 1,
              borderColor: "#E2E8F0",
              padding: 9,
              borderRadius: 18,
            }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#D97706" />
            ) : (
              <RefreshCw size={15} color="#64748B" />
            )}
          </Pressable>
        </View>
      </View>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* Dynamic Animated Weather Banner                                   */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={cardGradient as any}
        style={{
          borderRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: isNight ? "rgba(255, 184, 0, 0.25)" : "#FFE29A",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          {/* Animated Sky Icon */}
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: isNight ? "rgba(255, 255, 255, 0.08)" : "#FFF9ED",
              borderWidth: 2,
              borderColor: isNight ? "#38BDF8" : "#FFB800",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {isNight ? (
              <Moon size={32} color="#38BDF8" strokeWidth={2.4} />
            ) : weather?.cloud_cover_pct && weather.cloud_cover_pct > 60 ? (
              <Cloud size={32} color="#64748B" strokeWidth={2.4} />
            ) : weather?.cloud_cover_pct && weather.cloud_cover_pct > 20 ? (
              <CloudSun size={32} color="#D97706" strokeWidth={2.4} />
            ) : (
              <Sun size={32} color="#D97706" strokeWidth={2.4} />
            )}
          </View>

          <View style={{ gap: 2 }}>
            <Text
              style={{
                fontSize: 32,
                fontWeight: "900",
                color: isNight ? "#FFFFFF" : colors.midnight,
              }}
            >
              {weather?.temperature_c?.toFixed(1) ?? "18.0"}°C
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: isNight ? "#38BDF8" : "#B45309",
              }}
            >
              {weather?.weather_description || "Ciel dégagé"} ·{" "}
              <Text style={{ fontWeight: "500", color: isNight ? "#94A3B8" : colors.muted }}>
                Ressenti {weather?.apparent_temperature_c?.toFixed(1) ?? "17.5"}°C
              </Text>
            </Text>
          </View>
        </View>

        {/* Weather Parameters Badges */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <View
            style={{
              backgroundColor: isNight ? "rgba(255, 255, 255, 0.05)" : "#FFFFFF",
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: isNight ? "rgba(255, 255, 255, 0.1)" : "#FFE29A",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Cloud size={14} color="#64748B" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: isNight ? "#FFFFFF" : colors.midnight }}>
              Nuages : {weather?.cloud_cover_pct ?? 0}%
            </Text>
          </View>

          <View
            style={{
              backgroundColor: isNight ? "rgba(255, 255, 255, 0.05)" : "#FFFFFF",
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: isNight ? "rgba(255, 255, 255, 0.1)" : "#FFE29A",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Wind size={14} color="#38BDF8" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: isNight ? "#FFFFFF" : colors.midnight }}>
              Vent : {weather?.wind_speed_kmh?.toFixed(0) ?? 10} km/h
            </Text>
          </View>

          <View
            style={{
              backgroundColor: isNight ? "rgba(255, 255, 255, 0.05)" : "#FFFFFF",
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: isNight ? "rgba(255, 255, 255, 0.1)" : "#FFE29A",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Clock size={14} color="#F59E0B" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: isNight ? "#FFFFFF" : colors.midnight }}>
              Soleil : {weather?.sunrise ? weather.sunrise.slice(11, 16) : "06:45"} -{" "}
              {weather?.sunset ? weather.sunset.slice(11, 16) : "18:15"}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* Key Metric Blocks: Solar Score & PV Daily Production Forecast     */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {/* Solar Score (0 - 100) */}
        <View
          style={{
            flex: 1,
            minWidth: 260,
            backgroundColor: "#FFFBEB",
            borderRadius: 20,
            padding: 18,
            borderWidth: 1.5,
            borderColor: "#FDE68A",
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#B45309", letterSpacing: 1 }}>
              SOLAR SCORE DE LA JOURNÉE
            </Text>
            <View
              style={{
                backgroundColor: scoreColor,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#FFFFFF" }}>
                {score?.category === "excellent"
                  ? "EXCELLENT"
                  : score?.category === "moderate"
                  ? "MODÉRÉ"
                  : "FAIBLE"}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text style={{ fontSize: 36, fontWeight: "900", color: colors.midnight }}>
              {score?.score ?? 75}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#92400E" }}>/ 100</Text>
          </View>

          <Text style={{ fontSize: 12, color: "#92400E", lineHeight: 18 }}>
            {score?.explanation ||
              "Ensoleillement satisfaisant avec production photovoltaïque garantie."}
          </Text>
        </View>

        {/* PV Production Forecast (Today & Tomorrow) */}
        <View
          style={{
            flex: 1,
            minWidth: 260,
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: theme.colors.line,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: colors.midnight, letterSpacing: 1 }}>
              PRÉVISION PHOTOVOLTAÏQUE (3 kWC)
            </Text>
            <Zap size={16} color="#D97706" />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <View>
              <Text style={{ fontSize: 11, color: colors.muted }}>Aujourd'hui :</Text>
              <Text style={{ fontSize: 28, fontWeight: "900", color: isNight ? "#64748B" : "#D97706" }}>
                {isNight ? "0.0" : pv?.today_kwh?.toFixed(1) ?? "13.4"}{" "}
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.muted }}>kWh</Text>
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>Demain prévu :</Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: colors.midnight }}>
                {pv?.tomorrow_kwh?.toFixed(1) ?? "14.2"}{" "}
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>kWh</Text>
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "#F0FDF4",
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#BBF7D0",
            }}
          >
            <CheckCircle2 size={13} color="#16A34A" />
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534" }}>
              Meilleure plage autoconsommation : {pv?.best_window || "10:00 - 15:00"}
            </Text>
          </View>
        </View>

        {/* Live IoT Hardware Connection Link */}
        <View
          style={{
            flex: 1,
            minWidth: 240,
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: theme.colors.line,
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: colors.midnight, letterSpacing: 1 }}>
                CAPTEUR IOT LIVE
              </Text>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: iotConnected !== false ? "#10B981" : "#F59E0B",
                }}
              />
            </View>
            <Text style={{ fontSize: 22, fontWeight: "900", color: colors.midnight }}>
              {iotPowerW !== undefined ? `${iotPowerW.toFixed(3)} W` : "0.887 W"}
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>
              ESP32 DevKit V1 (Mokxi micro-panneau)
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/monitoring")}
            style={{
              backgroundColor: "#FFF9ED",
              borderWidth: 1,
              borderColor: "#FFE29A",
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#B45309" }}>
              Voir la télémétrie live →
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* Smart Daily Recommendation Box                                    */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <View
        style={{
          backgroundColor: "#FFF9ED",
          borderWidth: 1.5,
          borderColor: "#FFE29A",
          borderRadius: 16,
          padding: 14,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Sparkles size={20} color="#D97706" />
        <Text style={{ fontSize: 13, color: "#92400E", lineHeight: 20, flex: 1, fontWeight: "600" }}>
          {overview?.smart_recommendation ||
            "Profitez de la plage 10:00 - 15:00 pour lancer vos appareils énergivores et maximiser votre autoconsommation solaire."}
        </Text>
      </View>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* City Selector Modal                                               */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <Modal
        visible={isCityModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCityModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 440,
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              padding: 24,
              gap: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.midnight }}>
              Choisir une Localisation Météo
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Sélectionnez votre position pour actualiser le rayonnement et le Solar Score.
            </Text>

            {/* GPS Option */}
            <Pressable
              onPress={requestCurrentLocation}
              disabled={isLocating}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: "#FEF3C7",
                borderWidth: 1.5,
                borderColor: "#F59E0B",
                padding: 12,
                borderRadius: 14,
              }}
            >
              {isLocating ? (
                <ActivityIndicator size="small" color="#B45309" />
              ) : (
                <MapPin size={18} color="#B45309" />
              )}
              <View>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#B45309" }}>
                  Utiliser ma position actuelle (GPS)
                </Text>
                <Text style={{ fontSize: 11, color: "#92400E" }}>
                  Recherche automatique par Expo Location
                </Text>
              </View>
            </Pressable>

            {/* Saved Installation Option */}
            <Pressable
              onPress={handleSelectInstallation}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: "#F0F9FF",
                borderWidth: 1.5,
                borderColor: "#38BDF8",
                padding: 12,
                borderRadius: 14,
              }}
            >
              <Layers size={18} color="#0284C7" />
              <View>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#0369A1" }}>
                  Mon installation solaire enregistrée
                </Text>
                <Text style={{ fontSize: 11, color: "#0284C7" }}>
                  Métlaoui (Gafsa) · Rendement PV optimal
                </Text>
              </View>
            </Pressable>

            {/* City Grid */}
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginTop: 4 }}>
              Ou sélectionner une ville tunisienne :
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {CITIES.map((c) => {
                const active = selectedCity === c.name;
                return (
                  <Pressable
                    key={c.name}
                    onPress={() => handleSelectCity(c)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: active ? "#D97706" : "#E2E8F0",
                      backgroundColor: active ? "#FFF9ED" : "#F8FAFC",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: active ? "800" : "600",
                        color: active ? "#B45309" : colors.midnight,
                      }}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setIsCityModalOpen(false)}
              style={{
                alignSelf: "flex-end",
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: "#F1F5F9",
                marginTop: 6,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#64748B" }}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
