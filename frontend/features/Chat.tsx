import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Image,
  Linking,
  type ScrollViewInstance,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  Sun,
  Sparkles,
  Send,
  Paperclip,
  Trash2,
  X,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  FileText,
  User,
  ExternalLink,
  ArrowRight,
  Phone,
  Building2,
  CheckCircle2,
  Layers,
  Activity,
  Gauge,
  Zap,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  Radio,
  CloudSun,
} from "lucide-react-native";
import { Modal } from "react-native";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { speakResponse, stopSpeaking, isSpeaking } from "../services/voiceApi";
import { VoiceOrb, type VoiceState } from "../components/VoiceOrb";
import { useSolarStore } from "../store/useSolarStore";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import {
  GlassPanel,
  Title,
  Copy,
  StatusIndicator,
  PremiumButton,
  colors,
  s,
} from "../components/ui";
import { theme } from "../theme";
import {
  sendChatMessage,
  sendChatMessageStream,
  checkChatServiceStatus,
  type ChatMessage,
  type ChatAttachment,
  type ChatServiceStatus,
} from "../services/chatApi";

const STARTER_SUGGESTIONS = [
  "Analyser ma facture électrique",
  "Combien de panneaux solaires me faut-il ?",
  "Estimer mon budget d'installation",
  "Calculer mes économies potentielles",
  "Installer des panneaux sur ma toiture",
];

const WELCOME_TEXT =
  "Bonjour ! Je suis Solar AI, votre conseiller intelligent en énergie solaire. Envoyez-moi votre facture électrique ou expliquez-moi votre projet, et je vous accompagnerai vers une installation adaptée à vos besoins.";

function isArabicRTL(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  for (let i = 0; i < Math.min(trimmed.length, 30); i++) {
    const code = trimmed.charCodeAt(i);
    if (code >= 0x0600 && code <= 0x06ff) {
      return true;
    }
  }
  return false;
}

// Lightweight, bulletproof Markdown Formatter & Interactive Solar Cards for React Native & Web
function FormattedMessageText({
  text,
  onOpenStudio,
  onOpenMonitoring,
}: {
  text: string;
  onOpenStudio?: (card: any) => void;
  onOpenMonitoring?: () => void;
}) {
  let cardData: any = null;
  let cleanText = text;

  // Extract embedded SOLAR_CARD JSON if present
  const cardMatch = text.match(/<!--\s*SOLAR_CARD:\s*(\{.*?\})\s*-->/s);
  if (cardMatch && cardMatch[1]) {
    try {
      cardData = JSON.parse(cardMatch[1]);
      cleanText = text.replace(cardMatch[0], "").trim();
    } catch {
      // ignore partial json during streaming
    }
  }

  const rtl = isArabicRTL(cleanText);
  const lines = cleanText.split("\n");

  return (
    <View style={{ gap: 6, alignItems: rtl ? "flex-end" : "flex-start", width: "100%" }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={idx} style={{ height: 4 }} />;
        }

        // Header ###
        if (trimmed.startsWith("### ")) {
          return (
            <Text
              key={idx}
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: "#FFB800",
                marginTop: 6,
                textAlign: rtl ? "right" : "left",
              }}
            >
              {trimmed.replace(/^###\s+/, "")}
            </Text>
          );
        }
        // Header ##
        if (trimmed.startsWith("## ")) {
          return (
            <Text
              key={idx}
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: "#FFE29A",
                marginTop: 8,
                textAlign: rtl ? "right" : "left",
              }}
            >
              {trimmed.replace(/^##\s+/, "")}
            </Text>
          );
        }
        // Header #
        if (trimmed.startsWith("# ")) {
          return (
            <Text
              key={idx}
              style={{
                fontSize: 20,
                fontWeight: "800",
                color: "#FFFFFF",
                marginTop: 10,
                textAlign: rtl ? "right" : "left",
              }}
            >
              {trimmed.replace(/^#\s+/, "")}
            </Text>
          );
        }

        // Bullet point
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
          const bulletContent = trimmed.replace(/^[-•*]\s+/, "");
          return (
            <View
              key={idx}
              style={{
                flexDirection: rtl ? "row-reverse" : "row",
                gap: 8,
                paddingLeft: rtl ? 0 : 8,
                paddingRight: rtl ? 8 : 0,
              }}
            >
              <Text style={{ color: "#FFB800", fontSize: 14 }}>•</Text>
              <Text
                style={{
                  fontSize: 14.5,
                  color: "#FFFFFF",
                  lineHeight: 22,
                  flex: 1,
                  textAlign: rtl ? "right" : "left",
                }}
              >
                {renderInlineFormatting(bulletContent)}
              </Text>
            </View>
          );
        }

        // Standard paragraph
        return (
          <Text
            key={idx}
            style={{
              fontSize: 14.5,
              color: "#FFFFFF",
              lineHeight: 22,
              textAlign: rtl ? "right" : "left",
            }}
          >
            {renderInlineFormatting(trimmed)}
          </Text>
        );
      })}

      {/* Interactive Solar Sizing Card */}
      {cardData && cardData.type === "sizing_proposal" ? (
        <View
          style={{
            marginTop: 12,
            width: "100%",
            backgroundColor: "#0F172A",
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: "#FFB800",
            padding: 16,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sun size={20} color="#FFB800" strokeWidth={2.4} />
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#FFFFFF" }}>
                Recommandation Solaire
              </Text>
            </View>
            <View
              style={{
                backgroundColor: "rgba(255, 184, 0, 0.2)",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#FFB800",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFB800" }}>
                {cardData.location || "Tunisie"}
              </Text>
            </View>
          </View>

          {/* Metric Badges */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View
              style={{
                flex: 1,
                minWidth: 110,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                padding: 10,
                borderRadius: 10,
                borderLeftWidth: 3,
                borderLeftColor: "#FFB800",
              }}
            >
              <Text style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: "700" }}>
                Panneaux
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#FFE29A", marginTop: 2 }}>
                {cardData.panel_count} x {cardData.panel_wattage || 450}W
              </Text>
              <Text style={{ fontSize: 11, color: "#CBD5E1" }}>
                {cardData.installed_kwp} kWc réels
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 110,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                padding: 10,
                borderRadius: 10,
                borderLeftWidth: 3,
                borderLeftColor: "#38BDF8",
              }}
            >
              <Text style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: "700" }}>
                Production
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#38BDF8", marginTop: 2 }}>
                {cardData.annual_prod_kwh} kWh/an
              </Text>
              <Text style={{ fontSize: 11, color: "#CBD5E1" }}>
                {cardData.coverage_pct}% couverture
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 110,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                padding: 10,
                borderRadius: 10,
                borderLeftWidth: 3,
                borderLeftColor: "#34D399",
              }}
            >
              <Text style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: "700" }}>
                Surface
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#34D399", marginTop: 2 }}>
                ~{cardData.required_area_m2} m²
              </Text>
              <Text style={{ fontSize: 11, color: "#CBD5E1" }}>
                Toiture nécessaire
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 110,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                padding: 10,
                borderRadius: 10,
                borderLeftWidth: 3,
                borderLeftColor: "#F472B6",
              }}
            >
              <Text style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: "700" }}>
                Budget Net
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#F472B6", marginTop: 2 }}>
                {cardData.budget_tnd} DT
              </Text>
              <Text style={{ fontSize: 11, color: "#CBD5E1" }}>
                Prosol: ~{cardData.monthly_prosol_tnd} DT/mois
              </Text>
            </View>
          </View>

          {/* Interactive Button: Concevoir mon installation */}
          <Pressable
            onPress={() => onOpenStudio && onOpenStudio(cardData)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? "#E6A600" : "#FFB800",
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 4,
            })}
          >
            <Layers size={18} color="#17212E" strokeWidth={2.4} />
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#17212E" }}>
              Concevoir mon installation sur toiture
            </Text>
            <ArrowRight size={16} color="#17212E" strokeWidth={2.5} />
          </Pressable>
        </View>
      ) : null}

      {/* Interactive IoT Telemetry & Prediction Card */}
      {cardData && cardData.type === "iot_live_summary" ? (
        <View
          style={{
            marginTop: 12,
            width: "100%",
            backgroundColor: "#0F172A",
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: cardData.alert_level === "red" ? "#EF4444" : cardData.alert_level === "orange" ? "#F59E0B" : "#10B981",
            padding: 16,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Activity size={20} color="#F59E0B" strokeWidth={2.4} />
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#FFFFFF" }}>
                Télémétrie Live IoT & Alertes
              </Text>
            </View>
            <View
              style={{
                backgroundColor: cardData.alert_level === "orange" ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: cardData.alert_level === "orange" ? "#F59E0B" : "#10B981",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: cardData.alert_level === "orange" ? "#F59E0B" : "#10B981" }}>
                {cardData.alert_level === "orange" ? "Risque Dépassement" : "Conforme"}
              </Text>
            </View>
          </View>

          {/* Metric Badges */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View
              style={{
                flex: 1,
                minWidth: 110,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                padding: 10,
                borderRadius: 10,
                borderLeftWidth: 3,
                borderLeftColor: "#F59E0B",
              }}
            >
              <Text style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: "700" }}>
                Puissance Micro-PV
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#FFE29A", marginTop: 2 }}>
                {cardData.power_w !== undefined ? Number(cardData.power_w).toFixed(3) : "0.887"} W
              </Text>
              <Text style={{ fontSize: 11, color: "#CBD5E1" }}>
                U: {cardData.voltage_v !== undefined ? Number(cardData.voltage_v).toFixed(2) : "5.65"} V
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 110,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                padding: 10,
                borderRadius: 10,
                borderLeftWidth: 3,
                borderLeftColor: "#38BDF8",
              }}
            >
              <Text style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: "700" }}>
                Conso. Foyer
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#38BDF8", marginTop: 2 }}>
                {cardData.current_kwh !== undefined ? Number(cardData.current_kwh).toFixed(0) : "900"} kWh
              </Text>
              <Text style={{ fontSize: 11, color: "#CBD5E1" }}>
                Obj: {cardData.target_kwh !== undefined ? Number(cardData.target_kwh).toFixed(0) : "1200"} kWh
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 110,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                padding: 10,
                borderRadius: 10,
                borderLeftWidth: 3,
                borderLeftColor: "#EC4899",
              }}
            >
              <Text style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: "700" }}>
                Prévision Fin Mois
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#F472B6", marginTop: 2 }}>
                {cardData.forecast_kwh !== undefined ? Number(cardData.forecast_kwh).toFixed(0) : "1800"} kWh
              </Text>
              <Text style={{ fontSize: 11, color: "#CBD5E1" }}>
                Quota: {cardData.max_remaining_daily_kwh !== undefined ? Number(cardData.max_remaining_daily_kwh).toFixed(0) : "20"} kWh/j
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => onOpenMonitoring && onOpenMonitoring()}
            style={({ pressed }) => ({
              backgroundColor: pressed ? "#E6A600" : "#FFB800",
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 4,
            })}
          >
            <Activity size={18} color="#17212E" strokeWidth={2.4} />
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#17212E" }}>
              Consulter le Smart Energy Monitoring
            </Text>
            <ArrowRight size={16} color="#17212E" strokeWidth={2.5} />
          </Pressable>
        </View>
      ) : null}

      {/* Interactive Live Weather & Solar Overview Card */}
      {cardData && cardData.type === "weather_solar_overview" ? (
        <View
          style={{
            marginTop: 12,
            width: "100%",
            backgroundColor: "#0F172A",
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: "#FFB800",
            padding: 16,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sun size={20} color="#FFB800" strokeWidth={2.4} />
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#FFFFFF" }}>
                Météo & Potentiel Solaire ({cardData.city || "Tunisie"})
              </Text>
            </View>
            <View
              style={{
                backgroundColor: "rgba(255, 184, 0, 0.2)",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#FFB800",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFB800" }}>
                Score: {cardData.solar_score}/100
              </Text>
            </View>
          </View>

          {/* Metric Badges */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View
              style={{
                flex: 1,
                minWidth: 105,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                padding: 10,
                borderRadius: 10,
                borderLeftWidth: 3,
                borderLeftColor: "#38BDF8",
              }}
            >
              <Text style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: "700" }}>
                Météo Ciel
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#38BDF8", marginTop: 2 }}>
                {cardData.temp_c}°C
              </Text>
              <Text style={{ fontSize: 11, color: "#CBD5E1" }}>
                {cardData.condition}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 105,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                padding: 10,
                borderRadius: 10,
                borderLeftWidth: 3,
                borderLeftColor: "#10B981",
              }}
            >
              <Text style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: "700" }}>
                Production 3 kWc
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#10B981", marginTop: 2 }}>
                {cardData.today_pv_kwh} kWh
              </Text>
              <Text style={{ fontSize: 11, color: "#CBD5E1" }}>
                Prévu lyoum
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 105,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                padding: 10,
                borderRadius: 10,
                borderLeftWidth: 3,
                borderLeftColor: "#F59E0B",
              }}
            >
              <Text style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: "700" }}>
                Meilleure Plage
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#FDE68A", marginTop: 2 }}>
                {cardData.best_window || "10h - 15h"}
              </Text>
              <Text style={{ fontSize: 11, color: "#CBD5E1" }}>
                Pic solaire
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Interactive Installers List Card */}
      {cardData && cardData.type === "installers_list" && cardData.installers ? (
        <View
          style={{
            marginTop: 12,
            width: "100%",
            backgroundColor: "#0F172A",
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: "#38BDF8",
            padding: 16,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Building2 size={20} color="#38BDF8" />
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#FFFFFF" }}>
              Installateurs Agréés ANME & STEG ({cardData.location || "Région"})
            </Text>
          </View>

          {cardData.installers.map((inst: any, i: number) => (
            <View
              key={i}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                padding: 12,
                borderRadius: 12,
                gap: 6,
                borderLeftWidth: 3,
                borderLeftColor: "#38BDF8",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#FFE29A" }}>
                  {inst.name}
                </Text>
                <View
                  style={{
                    backgroundColor: "rgba(56, 189, 248, 0.15)",
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#38BDF8" }}>
                    {inst.anme_accreditation}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 12, color: "#94A3B8" }}>
                {inst.city} · Vérifié le {inst.verification_date}
              </Text>

              <Pressable
                onPress={() => Linking.openURL(`tel:${inst.phone}`)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  alignSelf: "flex-start",
                  backgroundColor: "rgba(255, 184, 0, 0.15)",
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  marginTop: 2,
                }}
              >
                <Phone size={13} color="#FFB800" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFB800" }}>
                  {inst.phone}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Inline formatting: **bold**
function renderInlineFormatting(str: string): React.ReactNode {
  const parts = str.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={i} style={{ fontWeight: "800", color: "#FFE29A" }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}

export default function Chat() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1050;

  function handleOpenStudio(cardData: any) {
    const currentStore = useSolarStore.getState();
    currentStore.set({
      input: {
        ...currentStore.input,
        annual: cardData.annual_kwh || 2400,
        watts: cardData.panel_wattage || 450,
        location: cardData.location || "Metlaoui",
        area: cardData.required_area_m2 || 6.0,
      },
      panelModel: {
        name: `Haute Efficacité ${cardData.panel_wattage || 450}W Bifacial`,
        power_w: cardData.panel_wattage || 450,
        width_m: 1.05,
        height_m: 1.76,
      },
    });
    router.push("/studio");
  }

  const routerParams = useLocalSearchParams<{ q?: string }>();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME_TEXT,
      timestamp: "Maintenant",
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState(routerParams.q || "");

  useEffect(() => {
    if (routerParams.q) {
      setInputPrompt(routerParams.q);
    }
  }, [routerParams.q]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ChatServiceStatus | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Voice Assistant & TTS State
  const voiceRecorder = useVoiceRecorder();
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (voiceRecorder.isRecording) {
      setVoiceState("listening");
    } else if (voiceRecorder.isTranscribing) {
      setVoiceState("transcribing");
    } else if (loading) {
      setVoiceState("thinking");
    }
  }, [voiceRecorder.isRecording, voiceRecorder.isTranscribing, loading]);

  const handleToggleSpeech = (msgId: string, content: string) => {
    if (playingMessageId === msgId) {
      stopSpeaking();
      setPlayingMessageId(null);
      setVoiceState("idle");
    } else {
      stopSpeaking();
      setPlayingMessageId(msgId);
      setVoiceState("speaking");
      speakResponse(content, {
        onDone: () => {
          setPlayingMessageId(null);
          setVoiceState("idle");
        },
        onError: () => {
          setPlayingMessageId(null);
          setVoiceState("idle");
        },
      });
    }
  };

  const existingPromptRef = useRef("");

  const handleStartVoiceRecording = async () => {
    stopSpeaking();
    setPlayingMessageId(null);
    existingPromptRef.current = inputPrompt.trim();
    await voiceRecorder.startRecording({
      language: "fr-FR",
      onInterimText: (interimText) => {
        const base = existingPromptRef.current ? existingPromptRef.current + " " : "";
        setInputPrompt(base + interimText);
      },
    });
  };

  const handleStopVoiceRecording = async () => {
    const text = await voiceRecorder.stopRecording();
    const base = existingPromptRef.current ? existingPromptRef.current + " " : "";
    const finalFull = (base + (text || voiceRecorder.liveTranscription || "")).trim();
    if (finalFull) {
      if (isVoiceMode) {
        handleSend(finalFull);
      } else {
        setInputPrompt(finalFull);
      }
    }
  };

  const handleCancelVoiceRecording = async () => {
    await voiceRecorder.cancelRecording();
    if (existingPromptRef.current) {
      setInputPrompt(existingPromptRef.current);
    }
  };

  const scrollRef = useRef<ScrollViewInstance | null>(null);

  useEffect(() => {
    checkChatServiceStatus()
      .then(setStatus)
      .catch(() => {
        setStatus({
          provider: "Google Gemini API",
          model: "gemini-3-flash-preview",
          ready: false,
          api_key_configured: false,
        });
      });
  }, []);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, loading]);

  async function handleSend(promptText?: string) {
    const textToSend = (promptText || inputPrompt).trim();
    if (!textToSend && attachments.length === 0) return;
    if (loading) return;

    setErrorMsg(null);
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: textToSend,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      timestamp: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...messages, userMsg];
    const assistantId = `assistant_${Date.now()}`;
    const placeholderAssistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages([...newHistory, placeholderAssistantMsg]);
    setInputPrompt("");
    setAttachments([]);
    setLoading(true);

    let accumulatedText = "";
    try {
      await sendChatMessageStream(
        newHistory,
        (chunk) => {
          accumulatedText += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulatedText } : m
            )
          );
        }
      );
    } catch (streamErr: any) {
      // Fallback to non-streaming endpoint if streaming fails
      try {
        const response = await sendChatMessage(newHistory);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: response.reply } : m
          )
        );
      } catch (fallbackErr: any) {
        setErrorMsg(fallbackErr.message || streamErr.message || "Erreur de connexion avec Solar AI.");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      setLoading(false);
      // Auto-speech playback
      if (accumulatedText && autoSpeak) {
        setVoiceState("speaking");
        setPlayingMessageId(assistantId);
        speakResponse(accumulatedText, {
          onDone: () => {
            setPlayingMessageId(null);
            setVoiceState("idle");
            if (isVoiceMode) {
              // Automatically resume listening for continuous conversation
              setTimeout(() => {
                handleStartVoiceRecording();
              }, 400);
            }
          },
          onError: () => {
            setPlayingMessageId(null);
            setVoiceState("idle");
          },
        });
      }
    }
  }

  // Pick an image from gallery
  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const asset = result.assets[0];
        const mime = asset.mimeType || "image/jpeg";
        const dataUrl = `data:${mime};base64,${asset.base64}`;
        setAttachments([
          ...attachments,
          {
            type: "image",
            data_url: dataUrl,
            name: "facture_photo.jpg",
          },
        ]);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Pick a document (PDF or image)
  async function pickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        // Read file to base64
        const res = await fetch(file.uri);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          setAttachments([
            ...attachments,
            {
              type: file.mimeType?.includes("pdf") ? "pdf" : "image",
              data_url: dataUrl,
              name: file.name,
            },
          ]);
        };
        reader.readAsDataURL(blob);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handleResetChat() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: WELCOME_TEXT,
        timestamp: "Maintenant",
      },
    ]);
    setInputPrompt("");
    setAttachments([]);
    setErrorMsg(null);
  }

  return (
    <ResponsiveLayout>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: "#FFB800",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#FFB800",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.35,
                shadowRadius: 6,
              }}
            >
              <Sparkles size={18} color="#17212E" strokeWidth={2.5} />
            </View>
            <Title>Solar AI</Title>
            <View
              style={{
                backgroundColor: "#FEF3C7",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#FDE68A",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400E" }}>
                {status?.model ? `${status.model} · ${status.provider}` : "Gemini 3 Flash · Google AI"}
              </Text>
            </View>
          </View>
          <Copy>Conseiller intelligent officiel en énergie photovoltaïque et analyse de factures</Copy>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Continuous Voice Mode Button */}
          <Pressable
            onPress={() => {
              setIsVoiceMode(true);
              handleStartVoiceRecording();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: "#FEF3C7",
              borderWidth: 1.5,
              borderColor: "#F59E0B",
            }}
          >
            <Radio size={15} color="#B45309" />
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#B45309" }}>
              Mode Vocal
            </Text>
          </Pressable>

          {/* Auto-speech toggle */}
          <Pressable
            onPress={() => {
              if (autoSpeak) stopSpeaking();
              setAutoSpeak(!autoSpeak);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: autoSpeak ? "#ECFDF5" : "#F1F5F9",
              borderWidth: 1,
              borderColor: autoSpeak ? "#A7F3D0" : "#CBD5E1",
            }}
          >
            {autoSpeak ? <Volume2 size={15} color="#059669" /> : <VolumeX size={15} color="#64748B" />}
            <Text style={{ fontSize: 12, fontWeight: "700", color: autoSpeak ? "#059669" : "#64748B" }}>
              {autoSpeak ? "Voix ON" : "Voix OFF"}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleResetChat}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: "#FFF9ED",
              borderWidth: 1,
              borderColor: "#FFE29A",
            }}
          >
            <RotateCcw size={15} color="#D97706" />
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#92400E" }}>
              Nouvelle conversation
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main Chat Container */}
      <GlassPanel
        style={{
          flex: 1,
          minHeight: 520,
          padding: 0,
          overflow: "hidden",
          borderRadius: 24,
          borderWidth: 1.5,
          borderColor: "#FFE29A",
          backgroundColor: "#FAF9F5",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Messages Scroll Area */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            padding: isDesktop ? 24 : 16,
            gap: 18,
          }}
          style={{ flex: 1 }}
        >
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const rtl = isArabicRTL(msg.content);

            return (
              <View
                key={msg.id}
                style={{
                  flexDirection: isUser ? "row-reverse" : "row",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                {/* Avatar */}
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: isUser ? "#17212E" : "#FFB800",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: isUser ? "#000" : "#FFB800",
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                  }}
                >
                  {isUser ? (
                    <User size={18} color="#FFFFFF" />
                  ) : (
                    <Sun size={20} color="#17212E" strokeWidth={2.4} />
                  )}
                </View>

                {/* Message Bubble */}
                <View
                  style={{
                    maxWidth: isDesktop ? "78%" : "84%",
                    backgroundColor: isUser ? "#FFFFFF" : "#17212E",
                    borderRadius: 20,
                    borderTopRightRadius: isUser ? 4 : 20,
                    borderTopLeftRadius: isUser ? 20 : 4,
                    padding: 16,
                    borderWidth: 1.5,
                    borderColor: isUser ? "#FFE29A" : "rgba(255, 184, 0, 0.3)",
                    shadowColor: isUser ? "#000" : "#FFB800",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isUser ? 0.05 : 0.15,
                    shadowRadius: 10,
                    elevation: 3,
                  }}
                >
                  {/* Sender label & Timestamp */}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 6,
                      gap: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: isUser ? "#D97706" : "#FFB800",
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                      }}
                    >
                      {isUser ? "Vous" : "Solar AI"}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {!isUser && msg.content ? (
                        <Pressable
                          accessibilityLabel={playingMessageId === msg.id ? "Arrêter la lecture vocale" : "Écouter la réponse"}
                          onPress={() => handleToggleSpeech(msg.id || "msg", msg.content)}
                          style={{
                            padding: 4,
                            borderRadius: 6,
                            backgroundColor: playingMessageId === msg.id ? "#FFB800" : "rgba(255, 255, 255, 0.12)",
                          }}
                        >
                          {playingMessageId === msg.id ? (
                            <Square size={12} color="#17212E" />
                          ) : (
                            <Volume2 size={12} color="#FFB800" />
                          )}
                        </Pressable>
                      ) : null}
                      {msg.timestamp ? (
                        <Text style={{ fontSize: 10, color: isUser ? "#94A3B8" : "#64748B" }}>
                          {msg.timestamp}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Attachment Previews */}
                  {msg.attachments && msg.attachments.length > 0 ? (
                    <View style={{ gap: 8, marginBottom: 10 }}>
                      {msg.attachments.map((att, i) => (
                        <View
                          key={i}
                          style={{
                            borderRadius: 12,
                            overflow: "hidden",
                            backgroundColor: "rgba(0,0,0,0.15)",
                            borderWidth: 1,
                            borderColor: "rgba(255, 184, 0, 0.4)",
                          }}
                        >
                          {att.type === "image" ? (
                            <Image
                              source={{ uri: att.data_url }}
                              style={{ width: "100%", height: 160, resizeMode: "cover" }}
                            />
                          ) : (
                            <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <FileText size={20} color="#FFB800" />
                              <Text style={{ fontSize: 13, color: isUser ? colors.ink : "#FFFFFF", fontWeight: "600" }}>
                                {att.name || "Facture PDF"}
                              </Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Message Content */}
                  {isUser ? (
                    <Text
                      style={{
                        fontSize: 15,
                        color: colors.ink,
                        lineHeight: 22,
                        textAlign: rtl ? "right" : "left",
                      }}
                    >
                      {msg.content}
                    </Text>
                  ) : msg.content ? (
                    <FormattedMessageText
                      text={msg.content}
                      onOpenStudio={handleOpenStudio}
                      onOpenMonitoring={() => router.push("/monitoring")}
                    />
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
                      <ActivityIndicator size="small" color="#FFB800" />
                      <Text style={{ fontSize: 13, color: "#FFE29A", fontStyle: "italic" }}>
                        Solar AI rédige sa réponse...
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Typing Indicator if waiting before stream starts */}
          {loading && messages[messages.length - 1]?.role !== "assistant" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: "#FFB800",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={18} color="#17212E" />
              </View>
              <View
                style={{
                  backgroundColor: "#17212E",
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  borderRadius: 18,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  borderWidth: 1,
                  borderColor: "rgba(255, 184, 0, 0.4)",
                }}
              >
                <ActivityIndicator size="small" color="#FFB800" />
                <Text style={{ fontSize: 13.5, color: "#FFE29A", fontWeight: "600" }}>
                  Solar AI analyse et formule sa réponse...
                </Text>
              </View>
            </View>
          ) : null}

          {/* Error Banner */}
          {errorMsg ? (
            <View
              style={{
                backgroundColor: "#FEE2E2",
                borderRadius: 14,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderWidth: 1,
                borderColor: "#FCA5A5",
              }}
            >
              <AlertCircle size={20} color="#DC2626" />
              <Text style={{ fontSize: 13, color: "#991B1B", flex: 1, fontWeight: "600" }}>
                {errorMsg}
              </Text>
              <Pressable
                onPress={() => handleSend()}
                style={{
                  backgroundColor: "#DC2626",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>Réessayer</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>

        {/* Starter Suggestions (Shown if conversation has only welcome message) */}
        {messages.length === 1 && (
          <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 8, letterSpacing: 0.5 }}>
              SUGGESTIONS POUR DÉMARRER :
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {STARTER_SUGGESTIONS.map((sug) => (
                <Pressable
                  key={sug}
                  onPress={() => handleSend(sug)}
                  style={{
                    backgroundColor: "#FFFFFF",
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: "#FFE29A",
                    shadowColor: "#FFB800",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 3,
                  }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: "600", color: "#92400E" }}>{sug}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Pending Attachment Preview Bar */}
        {attachments.length > 0 && (
          <View
            style={{
              paddingHorizontal: 18,
              paddingVertical: 8,
              backgroundColor: "#FFF9ED",
              borderTopWidth: 1,
              borderColor: "#FFE29A",
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
            }}
          >
            {attachments.map((att, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "#FFFFFF",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "#FDE68A",
                }}
              >
                <FileText size={14} color="#D97706" />
                <Text style={{ fontSize: 12, color: colors.ink, maxWidth: 140 }} numberOfLines={1}>
                  {att.name || "Pièce jointe"}
                </Text>
                <Pressable onPress={() => setAttachments(attachments.filter((_, idx) => idx !== i))}>
                  <X size={14} color="#64748B" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Active Voice Recording / Transcription Banner */}
        {voiceRecorder.isRecording && (
          <View
            style={{
              paddingHorizontal: 18,
              paddingVertical: 12,
              backgroundColor: "#FFFBEB",
              borderTopWidth: 1.5,
              borderColor: "#F59E0B",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: "#EF4444",
                }}
              />
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#B45309" }}>
                Enregistrement ({voiceRecorder.durationSeconds}s)
              </Text>
              {/* Reactive Soundwave Indicator */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, flex: 1 }}>
                {[0.4, 0.8, 1.2, 0.6, 1.0, 0.5, 0.9].map((multiplier, i) => (
                  <View
                    key={i}
                    style={{
                      width: 3.5,
                      height: Math.max(6, Math.min(26, voiceRecorder.audioVolume * 24 * multiplier)),
                      backgroundColor: "#D97706",
                      borderRadius: 2,
                    }}
                  />
                ))}
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={handleCancelVoiceRecording}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: "#F1F5F9",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#64748B" }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={handleStopVoiceRecording}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: "#D97706",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#FFFFFF" }}>Terminer</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Transcribing Indicator */}
        {voiceRecorder.isTranscribing && (
          <View
            style={{
              paddingHorizontal: 18,
              paddingVertical: 10,
              backgroundColor: "#EFF6FF",
              borderTopWidth: 1,
              borderColor: "#BFDBFE",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <ActivityIndicator size="small" color="#0284C7" />
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#0369A1" }}>
              Transcription vocale en cours (Faster-Whisper / Gemini)...
            </Text>
          </View>
        )}

        {/* Input Bar */}
        <View
          style={{
            padding: 14,
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderColor: theme.colors.line,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* Attachment button */}
          <Pressable
            accessibilityLabel="Joindre une image ou facture"
            onPress={pickImage}
            style={{
              padding: 10,
              borderRadius: 12,
              backgroundColor: "#FFF9ED",
              borderWidth: 1,
              borderColor: "#FFE29A",
            }}
          >
            <Paperclip size={18} color="#D97706" />
          </Pressable>

          {/* Text input */}
          <TextInput
            placeholder="Posez votre question ou parlez à Solar AI (FR, Arabe, Derja, EN, JA)..."
            placeholderTextColor="#94A3B8"
            value={inputPrompt}
            onChangeText={setInputPrompt}
            onSubmitEditing={() => handleSend()}
            multiline
            style={{
              flex: 1,
              backgroundColor: "#F8FAFC",
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 14.5,
              color: colors.ink,
              maxHeight: 100,
              borderWidth: 1,
              borderColor: theme.colors.line,
            }}
          />

          {/* Golden Microphone Button */}
          <Pressable
            accessibilityLabel="Enregistrer une question vocale"
            onPress={voiceRecorder.isRecording ? handleStopVoiceRecording : handleStartVoiceRecording}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: voiceRecorder.isRecording ? "#FEE2E2" : "#FFF9ED",
              borderWidth: 1.5,
              borderColor: voiceRecorder.isRecording ? "#EF4444" : "#F59E0B",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#FFB800",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            {voiceRecorder.isRecording ? (
              <Square size={17} color="#DC2626" />
            ) : (
              <Mic size={19} color="#D97706" strokeWidth={2.4} />
            )}
          </Pressable>

          {/* Send Button */}
          <Pressable
            accessibilityLabel="Envoyer à Solar AI"
            disabled={(!inputPrompt.trim() && attachments.length === 0) || loading}
            onPress={() => handleSend()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: (!inputPrompt.trim() && attachments.length === 0) || loading ? "#E2E8F0" : "#FFB800",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#FFB800",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: (!inputPrompt.trim() && attachments.length === 0) || loading ? 0 : 0.4,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            <Send
              size={18}
              color={(!inputPrompt.trim() && attachments.length === 0) || loading ? "#94A3B8" : "#17212E"}
            />
          </Pressable>
        </View>

        {/* Continuous Voice Conversation Modal */}
        <Modal
          visible={isVoiceMode}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setIsVoiceMode(false);
            stopSpeaking();
            voiceRecorder.cancelRecording();
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(15, 23, 42, 0.88)",
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 480,
                backgroundColor: "#FFFFFF",
                borderRadius: 32,
                padding: 30,
                alignItems: "center",
                gap: 22,
                borderWidth: 2,
                borderColor: "#FFE29A",
                shadowColor: "#FFB800",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 24,
                elevation: 10,
              }}
            >
              {/* Modal Header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Sparkles size={18} color="#D97706" />
                  <Text style={{ fontSize: 15, fontWeight: "900", color: colors.midnight }}>
                    Solar AI Voice Assistant
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setIsVoiceMode(false);
                    stopSpeaking();
                    voiceRecorder.cancelRecording();
                  }}
                  style={{
                    backgroundColor: "#F1F5F9",
                    padding: 8,
                    borderRadius: 12,
                  }}
                >
                  <X size={16} color="#64748B" />
                </Pressable>
              </View>

              {/* Central Glowing Solar Orb */}
              <VoiceOrb
                state={voiceState}
                volume={voiceRecorder.audioVolume}
                size={140}
              />

              {/* Live Status Description & Live Transcript */}
              <View style={{ alignItems: "center", gap: 6, minHeight: 70, paddingHorizontal: 10 }}>
                {voiceRecorder.isRecording ? (
                  <View style={{ alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#B45309", textAlign: "center" }}>
                      Écoute en cours... ({voiceRecorder.durationSeconds}s)
                    </Text>
                    {voiceRecorder.liveTranscription ? (
                      <Text style={{ fontSize: 15, fontWeight: "800", color: "#1E293B", textAlign: "center", fontStyle: "italic", paddingHorizontal: 12 }}>
                        « {voiceRecorder.liveTranscription} »
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 12, color: "#64748B", textAlign: "center" }}>
                        Parlez en tunisien, arabe, français, anglais ou japonais...
                      </Text>
                    )}
                  </View>
                ) : voiceRecorder.isTranscribing ? (
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0369A1", textAlign: "center" }}>
                    Transcription vocale en cours (Faster-Whisper)...
                  </Text>
                ) : loading ? (
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#D97706", textAlign: "center" }}>
                    Solar AI analyse votre question avec les données IoT...
                  </Text>
                ) : (
                  <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center", lineHeight: 18 }}>
                    Mode conversationnel continu : Solar AI vous écoute, répond à voix haute et reprend l'écoute naturellement.
                  </Text>
                )}
              </View>

              {/* Voice Controls Action Bar */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 4 }}>
                {/* Manual Record / Stop Toggle */}
                <Pressable
                  onPress={voiceRecorder.isRecording ? handleStopVoiceRecording : handleStartVoiceRecording}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: voiceRecorder.isRecording ? "#EF4444" : "#FFB800",
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 18,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 6,
                    elevation: 3,
                  }}
                >
                  {voiceRecorder.isRecording ? (
                    <>
                      <Square size={16} color="#FFFFFF" />
                      <Text style={{ fontSize: 13, fontWeight: "800", color: "#FFFFFF" }}>
                        Terminer ma question
                      </Text>
                    </>
                  ) : (
                    <>
                      <Mic size={16} color="#17212E" strokeWidth={2.5} />
                      <Text style={{ fontSize: 13, fontWeight: "800", color: "#17212E" }}>
                        Commencer à parler
                      </Text>
                    </>
                  )}
                </Pressable>

                {/* Mute TTS button */}
                <Pressable
                  onPress={() => {
                    stopSpeaking();
                    setVoiceState("idle");
                  }}
                  style={{
                    backgroundColor: "#F1F5F9",
                    padding: 12,
                    borderRadius: 18,
                  }}
                >
                  <VolumeX size={18} color="#64748B" />
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  setIsVoiceMode(false);
                  stopSpeaking();
                  voiceRecorder.cancelRecording();
                }}
                style={{ marginTop: 6 }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#94A3B8" }}>
                  Revenir au mode texte
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Privacy & Disclaimers Footer */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: "#FFFDF9",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            borderTopWidth: 1,
            borderColor: theme.colors.line,
          }}
        >
          <ShieldCheck size={14} color="#10B981" />
          <Text style={{ fontSize: 11, color: colors.muted, textAlign: "center" }}>
            Données personnelles automatiquement anonymisées · Estimations indicatives à valider par un installateur
          </Text>
        </View>
      </GlassPanel>
    </ResponsiveLayout>
  );
}
