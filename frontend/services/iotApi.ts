import { Platform } from "react-native";
import { getBackendBaseUrl } from "./rooftopApi";

export interface LiveEnergyData {
  status: "active" | "idle" | "disconnected" | "demo";
  connected: boolean;
  badge: "Simulation Mokxi" | "Installation physique" | "Mode démonstration";
  device_id: string;
  voltage_v: number;
  current_a: number;
  current_ma: number;
  power_w: number;
  cumulative_energy_wh: number;
  cumulative_energy_kwh: number;
  timestamp: string;
  timestamp_tunis: string;
  age_seconds: number;
}

export interface EnergyDataPoint {
  time: string;
  label: string;
  voltage_v: number;
  current_a: number;
  current_ma: number;
  power_w: number;
  cumulative_wh: number;
}

export interface EnergyHistoryResponse {
  range: string;
  count: number;
  timezone: string;
  data: EnergyDataPoint[];
  total_energy_wh: number;
  total_energy_kwh: number;
  avg_power_w: number;
  peak_power_w: number;
}

export interface ConsumptionPredictionResponse {
  monthly_target_kwh: number;
  current_consumption_kwh: number;
  current_day: number;
  total_days_in_month: number;
  remaining_days: number;
  consumed_pct: number;
  daily_avg_kwh: number;
  forecast_month_end_kwh: number;
  forecast_overrun_kwh: number;
  remaining_allowed_kwh: number;
  max_remaining_daily_kwh: number;
  reduction_req_pct: number;
  is_overrun_risk: boolean;
  alert_level: "green" | "orange" | "red";
  alert_title: string;
  alert_message: string;
}

export interface UserObjectives {
  id?: number;
  monthly_consumption_target_kwh: number;
  monthly_budget_tnd: number;
  monthly_solar_target_kwh: number;
  reduction_target_pct: number;
  updated_at?: string;
}

export interface SmartAlert {
  id: number;
  timestamp: string;
  level: "green" | "orange" | "red";
  type: string;
  title: string;
  message: string;
  is_read: boolean;
}

export interface MonitoringSummary {
  live: LiveEnergyData;
  objectives: UserObjectives;
  prediction: ConsumptionPredictionResponse;
  recent_alerts: SmartAlert[];
}

export type HistoryRange = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";

// ─────────────────────────────────────────────────────────────────────────────
// API Methods
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchMonitoringSummary(): Promise<MonitoringSummary> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/iot/summary`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Erreur récupération résumé IoT (${res.status})`);
  }
  return res.json();
}

export async function fetchLiveEnergy(): Promise<LiveEnergyData> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/iot/live`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Erreur lecture temps réel IoT (${res.status})`);
  }
  return res.json();
}

export async function fetchEnergyHistory(
  rangeType: HistoryRange = "minute",
  limit: number = 60
): Promise<EnergyHistoryResponse> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/iot/history?range_type=${rangeType}&limit=${limit}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Erreur historique IoT (${res.status})`);
  }
  return res.json();
}

export async function fetchPrediction(params?: {
  target_kwh?: number;
  current_kwh?: number;
  current_day?: number;
  total_days?: number;
}): Promise<ConsumptionPredictionResponse> {
  const base = getBackendBaseUrl();
  const query = new URLSearchParams();
  if (params?.target_kwh !== undefined) query.append("target_kwh", String(params.target_kwh));
  if (params?.current_kwh !== undefined) query.append("current_kwh", String(params.current_kwh));
  if (params?.current_day !== undefined) query.append("current_day", String(params.current_day));
  if (params?.total_days !== undefined) query.append("total_days", String(params.total_days));

  const qs = query.toString();
  const url = `${base}/api/iot/prediction${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Erreur prédiction (${res.status})`);
  }
  return res.json();
}

export async function fetchUserObjectives(): Promise<UserObjectives> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/iot/objectives`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Erreur lecture objectifs (${res.status})`);
  }
  return res.json();
}

export async function saveUserObjectives(objs: {
  monthly_consumption_target_kwh: number;
  monthly_budget_tnd: number;
  monthly_solar_target_kwh: number;
  reduction_target_pct: number;
}): Promise<UserObjectives> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/iot/objectives`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(objs),
  });
  if (!res.ok) {
    throw new Error(`Erreur sauvegarde objectifs (${res.status})`);
  }
  return res.json();
}

export async function fetchAlerts(limit: number = 20): Promise<{ alerts: SmartAlert[] }> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/iot/alerts?limit=${limit}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Erreur liste alertes (${res.status})`);
  }
  return res.json();
}

export async function markAlertRead(alertId: number): Promise<{ success: boolean; alert_id: number }> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/iot/alerts/read/${alertId}`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Erreur acquittement alerte (${res.status})`);
  }
  return res.json();
}
