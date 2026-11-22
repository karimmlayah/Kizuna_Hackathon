import { getBackendBaseUrl } from "./rooftopApi";

export interface CurrentWeatherData {
  city: string;
  latitude: number;
  longitude: number;
  time: string;
  temperature_c: number;
  apparent_temperature_c: number;
  humidity_pct: number;
  cloud_cover_pct: number;
  wind_speed_kmh: number;
  weather_code: number;
  weather_description: string;
  weather_condition: string;
  icon: string;
  is_night: boolean;
  sunrise: string;
  sunset: string;
  source: string;
  last_updated: string;
}

export interface SolarScoreData {
  score: number;
  category: "excellent" | "moderate" | "low";
  title: string;
  explanation: string;
  today_radiation_mj: number;
  cloud_cover_pct: number;
  weather_code: number;
  city?: string;
}

export interface HourlyForecastItem {
  time: string;
  hour: string;
  gti_w_m2: number;
  temp_c: number;
  power_kw: number;
  energy_kwh: number;
}

export interface DailyForecastItem {
  date: string;
  day_name: string;
  radiation_sum_mj: number;
  estimated_production_kwh: number;
  weather_code: number;
}

export interface PVForecastData {
  kwp_installed: number;
  today_production_kwh: number;
  tomorrow_production_kwh: number;
  peak_power_kw: number;
  best_solar_window: string;
  hourly_today: HourlyForecastItem[];
  seven_day_forecast: DailyForecastItem[];
  city?: string;
}

export interface SolarOverviewData {
  greeting: string;
  city: string;
  weather: CurrentWeatherData;
  solar_score: SolarScoreData;
  pv_forecast: {
    today_kwh: number;
    tomorrow_kwh: number;
    peak_kw: number;
    best_window: string;
    hourly_today: HourlyForecastItem[];
    seven_day: DailyForecastItem[];
  };
  smart_recommendation: string;
  source: string;
  timestamp_tunis: string;
}

export interface WeatherQueryOptions {
  lat?: number;
  lon?: number;
  city?: string;
  kwp?: number;
}

function buildQuery(opts?: WeatherQueryOptions): string {
  if (!opts) return "";
  const params = new URLSearchParams();
  if (opts.lat !== undefined) params.append("lat", String(opts.lat));
  if (opts.lon !== undefined) params.append("lon", String(opts.lon));
  if (opts.city) params.append("city", opts.city);
  if (opts.kwp !== undefined) params.append("kwp", String(opts.kwp));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchCurrentWeather(opts?: WeatherQueryOptions): Promise<CurrentWeatherData> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/weather/current${buildQuery(opts)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Erreur météo actuelle (${res.status})`);
  return res.json();
}

export async function fetchSolarScore(opts?: WeatherQueryOptions): Promise<SolarScoreData> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/energy/solar-score${buildQuery(opts)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Erreur Solar Score (${res.status})`);
  return res.json();
}

export async function fetchProductionForecast(opts?: WeatherQueryOptions): Promise<PVForecastData> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/energy/production-forecast${buildQuery(opts)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Erreur prévision de production (${res.status})`);
  return res.json();
}

export async function fetchSolarOverview(opts?: WeatherQueryOptions): Promise<SolarOverviewData> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/energy/overview${buildQuery(opts)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Erreur Solar Overview (${res.status})`);
  return res.json();
}
