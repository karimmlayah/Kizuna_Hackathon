import { Platform } from "react-native";
import * as Speech from "expo-speech";
import { getBackendBaseUrl } from "./rooftopApi";

export interface TranscriptionResponse {
  transcription: string;
  detected_language: string;
  engine: string;
  processing_time_s: number;
  domain_context_applied: boolean;
}

export interface SynthesisResponse {
  original_text: string;
  clean_text: string;
  short_spoken_text: string;
  phonetic_arabic: string;
  is_arabizi: boolean;
  recommended_voice_lang: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Backend Voice API Calls
// ─────────────────────────────────────────────────────────────────────────────

export async function transcribeAudio(
  audioBase64: string,
  format: string = "webm",
  language?: string
): Promise<TranscriptionResponse> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/voice/transcribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      audio_base64: audioBase64,
      format,
      language,
    }),
  });

  if (!res.ok) {
    throw new Error(`Erreur transcription vocale (${res.status})`);
  }
  return res.json();
}

export async function fetchSynthesizeText(text: string): Promise<SynthesisResponse> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/voice/synthesize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`Erreur préparation vocale (${res.status})`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Cross-Platform Text-to-Speech (TTS) Manager
// ─────────────────────────────────────────────────────────────────────────────

export async function speakResponse(
  text: string,
  options?: {
    onDone?: () => void;
    onError?: (err: any) => void;
  }
): Promise<void> {
  try {
    // 1. Fetch phonetic Arabic translation and clean spoken version from backend
    const synthData = await fetchSynthesizeText(text).catch(() => ({
      short_spoken_text: text,
      phonetic_arabic: text,
      is_arabizi: false,
      recommended_voice_lang: "fr-FR",
    }));

    // For Tunisian Arabizi, speak phonetic Arabic script; otherwise speak clean text
    const textToSpeak = synthData.is_arabizi && synthData.phonetic_arabic
      ? synthData.phonetic_arabic
      : synthData.short_spoken_text;

    const lang = synthData.recommended_voice_lang || (synthData.is_arabizi ? "ar-TN" : "fr-FR");

    // 2. Web Speech API on Web browser (offers wide voice selection)
    if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = lang;

      // Try to find a matching Arabic or French voice
      const voices = window.speechSynthesis.getVoices();
      const targetPrefix = lang.slice(0, 2);
      const voice = voices.find((v) => v.lang.startsWith(targetPrefix)) || voices.find((v) => v.lang.startsWith("fr"));
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => options?.onDone?.();
      utterance.onerror = (e) => options?.onError?.(e);

      window.speechSynthesis.speak(utterance);
      return;
    }

    // 3. Expo Speech on iOS / Android
    await Speech.stop();
    Speech.speak(textToSpeak, {
      language: lang,
      pitch: 1.0,
      rate: 0.95,
      onDone: options?.onDone,
      onError: options?.onError,
    });
  } catch (err) {
    console.warn("TTS Error:", err);
    options?.onError?.(err);
  }
}

export function stopSpeaking(): void {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    Speech.stop();
  } catch (err) {
    // ignore
  }
}

export async function isSpeaking(): Promise<boolean> {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
      return window.speechSynthesis.speaking;
    }
    return Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
