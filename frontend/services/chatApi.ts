import { getBackendBaseUrl } from "./rooftopApi";

export interface ChatAttachment {
  type: "image" | "pdf";
  data_url: string;
  name?: string;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: ChatAttachment[];
  timestamp?: string;
}

export interface ChatApiResponse {
  status: string;
  reply: string;
  role: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  telemetry?: {
    request_duration_s?: number;
    http_status?: number;
    images?: any[];
  };
}

export interface ChatServiceStatus {
  provider: string;
  model: string;
  ready: boolean;
  api_key_configured: boolean;
  reasoning_effort?: string;
  max_tokens?: number;
  temperature?: number;
  streaming_supported?: boolean;
}

export async function checkChatServiceStatus(): Promise<ChatServiceStatus> {
  const url = `${getBackendBaseUrl()}/api/chat/status`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Service indisponible (${res.status})`);
  }
  return await res.json();
}

/**
 * Filter message history to send attachments only for the latest message with attachments.
 * Prevents redundant transmission of large base64 images in multi-turn conversations.
 */
function preparePayloadMessages(messages: ChatMessage[]) {
  let lastAttIdx = -1;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg?.attachments && msg.attachments.length > 0) {
      lastAttIdx = i;
    }
  }

  return messages.map((m, idx) => ({
    role: m.role,
    content: m.content,
    attachments: idx === lastAttIdx ? m.attachments : undefined,
  }));
}

export async function sendChatMessage(
  messages: ChatMessage[],
  userConsent = true
): Promise<ChatApiResponse> {
  const url = `${getBackendBaseUrl()}/api/chat`;

  const payload = {
    messages: preparePayloadMessages(messages),
    user_consent_anonymization: userConsent,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errDetail = "Erreur de communication avec Solar AI";
    try {
      const errJson = await res.json();
      errDetail = errJson.detail || errDetail;
    } catch {
      errDetail = await res.text();
    }
    throw new Error(errDetail);
  }

  return await res.json();
}

/**
 * Stream Solar AI completion via Server-Sent Events (SSE).
 * Updates response text progressively in real time.
 */
export async function sendChatMessageStream(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  userConsent = true
): Promise<string> {
  const url = `${getBackendBaseUrl()}/api/chat/stream`;

  const payload = {
    messages: preparePayloadMessages(messages),
    user_consent_anonymization: userConsent,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errDetail = `Erreur (${res.status})`;
    try {
      const errJson = await res.json();
      errDetail = errJson.detail || errDetail;
    } catch {
      errDetail = await res.text();
    }
    throw new Error(errDetail);
  }

  let fullReply = "";

  // Stream reader support (Web, iOS/Android fetch environments)
  if (res.body && typeof (res.body as any).getReader === "function") {
    const reader = (res.body as any).getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === "[DONE]") break;
        try {
          const parsed = JSON.parse(dataStr);
          const chunkText = parsed.content || parsed.text;
          if (chunkText) {
            fullReply += chunkText;
            onChunk(chunkText);
          } else if (parsed.type === "error" && parsed.error) {
            throw new Error(parsed.error);
          } else if (parsed.error) {
            throw new Error(parsed.error);
          }
        } catch (e: any) {
          if (e.message && !e.message.includes("JSON")) {
            throw e;
          }
        }
      }
    }
  } else {
    // Fallback if streaming body reader is unavailable: parse line-by-line response
    const text = await res.text();
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const dataStr = trimmed.slice(6);
      if (dataStr === "[DONE]") break;
      try {
        const parsed = JSON.parse(dataStr);
        const chunkText = parsed.content || parsed.text;
        if (chunkText) {
          fullReply += chunkText;
          onChunk(chunkText);
        }
      } catch {}
    }
  }

  return fullReply;
}
