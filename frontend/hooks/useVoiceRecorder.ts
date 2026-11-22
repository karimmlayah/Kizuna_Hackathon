import { useState, useRef, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { transcribeAudio, type TranscriptionResponse } from "../services/voiceApi";

export interface VoiceRecorderOptions {
  onInterimText?: (text: string) => void;
  language?: string; // "ar-TN", "fr-FR", "en-US", etc.
  appendMode?: boolean;
}

export interface VoiceRecorderHook {
  isRecording: boolean;
  isTranscribing: boolean;
  audioVolume: number; // 0.0 to 1.0
  durationSeconds: number;
  transcription: string | null;
  liveTranscription: string;
  error: string | null;
  startRecording: (options?: VoiceRecorderOptions) => Promise<boolean>;
  stopRecording: () => Promise<string | null>;
  cancelRecording: () => Promise<void>;
  clearTranscription: () => void;
}

export function useVoiceRecorder(): VoiceRecorderHook {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.1);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [liveTranscription, setLiveTranscription] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Web refs
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const animFrameRef = useRef<any>(null);
  const speechRecognitionRef = useRef<any>(null);
  const interimCallbackRef = useRef<((text: string) => void) | null>(null);
  const initialTextRef = useRef<string>("");

  // Native refs
  const nativeRecordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<any>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {}
      }
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Web Audio Recording, SpeechRecognition & Volume Metering
  // ───────────────────────────────────────────────────────────────────────────
  const startWebRecording = async (options?: VoiceRecorderOptions): Promise<boolean> => {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("Microphone non supporté sur ce navigateur.");
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // Volume metering via Web Audio API
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] ?? 0;
          }
          const avg = sum / dataArray.length;
          setAudioVolume(Math.min(1.0, Math.max(0.05, avg / 128.0)));
          animFrameRef.current = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      } catch (audioCtxErr) {
        // Metering fallback
      }

      // 1. Web Speech API for Live Instant Transcription
      if (typeof window !== "undefined") {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          try {
            const recognition = new SpeechRec();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = options?.language || "fr-FR"; // or "ar-TN"

            recognition.onresult = (event: any) => {
              let fullLive = "";
              for (let i = 0; i < event.results.length; ++i) {
                const res = event.results[i];
                if (res && res[0]) {
                  fullLive += res[0].transcript + " ";
                }
              }
              const cleanLive = fullLive.trim();
              if (cleanLive) {
                setLiveTranscription(cleanLive);
                if (interimCallbackRef.current) {
                  interimCallbackRef.current(cleanLive);
                }
              }
            };

            recognition.onerror = (e: any) => {
              // Non-critical, fallback to audio file transcription
              console.warn("[WebSpeech interim]", e.error);
            };

            speechRecognitionRef.current = recognition;
            recognition.start();
          } catch (e) {
            console.warn("Could not start WebSpeech recognition:", e);
          }
        }
      }

      // 2. MediaRecorder for full fidelity Whisper / Gemini processing
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      recorder.ondataavailable = (event: any) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // 250ms chunks

      return true;
    } catch (err: any) {
      console.warn("Web getUserMedia error:", err);
      setError("Accès microphone refusé ou indisponible.");
      return false;
    }
  };

  const stopWebRecording = async (): Promise<string | null> => {
    // Stop live recognition
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        resolve(liveTranscription || null);
        return;
      }

      recorder.onstop = async () => {
        try {
          if (recorder.stream) {
            recorder.stream.getTracks().forEach((track: any) => track.stop());
          }
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
          if (audioContextRef.current) {
            try {
              audioContextRef.current.close();
            } catch {}
          }

          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          if (audioBlob.size < 100) {
            resolve(liveTranscription || null);
            return;
          }

          setIsTranscribing(true);
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            try {
              const resultStr = (reader.result as string) || "";
              const base64Data = resultStr.includes(",") ? resultStr.split(",")[1] || "" : resultStr;
              
              // Backend Faster-Whisper + Arabizi Phonetic Processing
              const res = await transcribeAudio(base64Data, "webm");
              const finalVal = res.transcription || liveTranscription;
              setTranscription(finalVal);
              resolve(finalVal);
            } catch (err: any) {
              console.warn("Backend transcription fallback to live:", err);
              // Graceful fallback to live transcription captured from Web Speech API
              const fallback = liveTranscription || null;
              setTranscription(fallback);
              resolve(fallback);
            } finally {
              setIsTranscribing(false);
            }
          };
        } catch (e) {
          resolve(liveTranscription || null);
        }
      };

      recorder.stop();
    });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Native (iOS / Android) Recording & Metering via Expo AV
  // ───────────────────────────────────────────────────────────────────────────
  const startNativeRecording = async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        setError("Permission microphone refusée.");
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (recordStatus) => {
          if (recordStatus.metering !== undefined) {
            const db = recordStatus.metering;
            const normalized = Math.min(1.0, Math.max(0.05, (db + 60) / 60));
            setAudioVolume(normalized);
          }
        },
        150
      );

      nativeRecordingRef.current = recording;
      return true;
    } catch (err: any) {
      console.warn("Native recording start error:", err);
      setError("Impossible d'initialiser l'enregistrement.");
      return false;
    }
  };

  const stopNativeRecording = async (): Promise<string | null> => {
    const rec = nativeRecordingRef.current;
    if (!rec) return null;

    try {
      setIsTranscribing(true);
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      nativeRecordingRef.current = null;

      if (!uri) {
        setIsTranscribing(false);
        return null;
      }

      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64" as any,
      });

      const ext = uri.split(".").pop() || "m4a";
      const res = await transcribeAudio(base64Data, ext);
      setTranscription(res.transcription);
      return res.transcription;
    } catch (err: any) {
      setError("Erreur transcription native.");
      return null;
    } finally {
      setIsTranscribing(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Public Methods
  // ───────────────────────────────────────────────────────────────────────────
  const startRecording = useCallback(async (options?: VoiceRecorderOptions): Promise<boolean> => {
    setError(null);
    setTranscription(null);
    setLiveTranscription("");
    setDurationSeconds(0);
    interimCallbackRef.current = options?.onInterimText || null;

    const ok = Platform.OS === "web" 
      ? await startWebRecording(options) 
      : await startNativeRecording();

    if (ok) {
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setDurationSeconds((d) => d + 1);
      }, 1000);
    }
    return ok;
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setAudioVolume(0.1);

    if (Platform.OS === "web") {
      return stopWebRecording();
    } else {
      return stopNativeRecording();
    }
  }, [liveTranscription]);

  const cancelRecording = useCallback(async (): Promise<void> => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setAudioVolume(0.1);
    setDurationSeconds(0);
    setTranscription(null);
    setLiveTranscription("");
    interimCallbackRef.current = null;

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }

    if (Platform.OS === "web") {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach((t: any) => t.stop());
        }
      }
    } else {
      if (nativeRecordingRef.current) {
        try {
          await nativeRecordingRef.current.stopAndUnloadAsync();
        } catch {}
        nativeRecordingRef.current = null;
      }
    }
  }, []);

  const clearTranscription = useCallback(() => {
    setTranscription(null);
    setLiveTranscription("");
  }, []);

  return {
    isRecording,
    isTranscribing,
    audioVolume,
    durationSeconds,
    transcription,
    liveTranscription,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    clearTranscription,
  };
}
