import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

// Default backend endpoint: localhost for Web, LAN Wi-Fi IP for native Expo Go on iPhone/Android
const DEFAULT_LAN_IP = "172.17.12.112";
const PORT = 8003;

export function getBackendBaseUrl(): string {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location.hostname) {
      return `http://${window.location.hostname}:${PORT}`;
    }
    return `http://localhost:${PORT}`;
  }
  return `http://${DEFAULT_LAN_IP}:${PORT}`;
}

/**
 * Universal helper: safely convert any image URI (blob:, file://, http(s):// or raw base64)
 * into a clean base64 data string ready for FastAPI AI endpoints.
 */
export async function ensureImageBase64(imageInput: string): Promise<string> {
  if (!imageInput) {
    throw new Error("Aucune image de toiture fournie.");
  }

  // 1. If it's already a Data URL (data:image/...;base64,...)
  if (imageInput.startsWith("data:")) {
    const comma = imageInput.lastIndexOf(",");
    return comma !== -1 ? imageInput.slice(comma + 1).trim() : imageInput.trim();
  }

  // 2. If it's a blob: or network http(s) URL (Web upload or network resource)
  if (
    imageInput.startsWith("blob:") ||
    imageInput.startsWith("http://") ||
    imageInput.startsWith("https://")
  ) {
    try {
      const resp = await fetch(imageInput);
      const blob = await resp.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          const comma = res.lastIndexOf(",");
          resolve(comma !== -1 ? res.slice(comma + 1).trim() : res.trim());
        };
        reader.onerror = () => reject(new Error("Impossible de lire l'image en base64."));
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("[rooftopApi] Fetch blob to base64 failed:", e);
    }
  }

  // 3. If it's a local file URI on mobile device
  if (Platform.OS !== "web" && (imageInput.startsWith("file://") || imageInput.startsWith("/"))) {
    try {
      const base64 = await FileSystem.readAsStringAsync(imageInput, {
        encoding: "base64" as any,
      });
      if (base64) return base64.trim();
    } catch (fsErr) {
      console.warn("[rooftopApi] FileSystem read failed:", fsErr);
    }
  }

  // 4. Default fallback: strip comma if present
  return imageInput.includes(",") ? imageInput.split(",").pop()!.trim() : imageInput.trim();
}

/**
 * Sanitizes any data URI, stripping accidental double prefixes like:
 * "data:image/png;base64,data:image/png;base64,..."
 */
export function sanitizeDataUri(input: string | null | undefined, mime = "image/png"): string | null {
  if (!input) return null;
  const str = input.trim();
  if (!str) return null;

  // If it's a web/network URL or blob URL, return as is
  if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("blob:") || str.startsWith("file://")) {
    return str;
  }

  // If it contains data: prefix(es), extract the raw base64 after the last comma
  if (str.includes(",")) {
    const raw = str.split(",").pop()!.trim();
    return `data:${mime};base64,${raw}`;
  }

  // Otherwise, it's bare base64
  return `data:${mime};base64,${str}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Types
// ─────────────────────────────────────────────────────────────────────────────
export interface RooftopMetrics {
  total_roof_area_m2: number;
  usable_roof_area_m2: number;
  occupied_area_m2: number;
  recommended_panels: number;
  placed_panels: number;
  max_possible_panels: number;
  orientation: "portrait" | "landscape";
  installed_kwp: number;
  annual_production_kwh: number;
  cost_tnd: number;
  annual_savings_tnd: number;
  roi_years: number;
  confidence: number;
}

export interface PlacedPanel {
  id: string;
  x_px?: number;
  y_px?: number;
  w_px?: number;
  h_px?: number;
  x_pct: number;
  y_pct: number;
  w_pct: number;
  h_pct: number;
  rotation?: number;
  valid?: boolean;
  power_w?: number;
  warning?: string;
}

export interface RooftopContourPoint {
  x_px: number;
  y_px: number;
  x_pct: number;
  y_pct: number;
}

export interface RooftopAnalysisResponse {
  status: string;
  metrics: RooftopMetrics;
  contours: RooftopContourPoint[][];
  primary_placement: PlacedPanel[];
  alternative_placement: PlacedPanel[];
  explanation: string;
  images: {
    mask: string;
    original_preview: string;
  };
}

export interface AiSuggestion {
  type: string;
  message: string;
  affected_ids?: string[];
  recommended_add?: number;
  extra_panels?: number;
}

export interface AiAdviseResponse {
  valid_count: number;
  total_count: number;
  invalid_panels: string[];
  overlapping_panels: string[];
  installed_kwp: number;
  annual_kwh: number;
  annual_savings_tnd: number;
  suggestions: AiSuggestion[];
}

export interface SamMaskInfo {
  id: number;
  area: number;
  area_pct: number;
  bbox: [number, number, number, number];
  stability_score: number;
  predicted_iou: number;
  is_roof_candidate: boolean;
  is_obstacle: boolean;
  polygon: [number, number][];
}

export interface SamSegmentResponse {
  status: string;
  device: string;
  dimensions: [number, number];
  total_masks: number;
  recommended_roof_mask_id: number;
  obstacles_detected: number[];
  masks: SamMaskInfo[];
  overlay_b64: string;
  safe_zone_b64?: string;
  session_id?: string;
  processing_time_s: number;
}

export interface SamSelectMaskResponse {
  status: string;
  roof_mask_id: number;
  obstacle_mask_ids: number[];
  roof_polygon: [number, number][];
  obstacle_polygons: [number, number][][];
  overlay_b64: string;
  safe_zone_b64: string;
  session_id: string;
}

export interface SamCalibrateResponse {
  status: string;
  calibrated: boolean;
  real_area_m2?: number;
  px_per_m?: number;
  aspect_ratio?: number;
  warped_preview_b64?: string;
  message: string;
}

export interface SamPlacedPanelModel {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  corners: [number, number][];
  rotation_deg: number;
  is_valid: boolean;
  warning?: string;
}

export interface SamPlanResponse {
  status: string;
  session_id: string;
  dimensions: [number, number];
  roof_polygon: [number, number][];
  obstacle_polygons: [number, number][][];
  panels_requested: number;
  panels_placed: number;
  all_fitted: bool;
  installed_kwp: number;
  panel_wattage_w: number;
  panels: SamPlacedPanelModel[];
  calibration_method: string;
  realistic_render_b64: string;
  processing_time_s: number;
}

type bool = boolean;

export interface ConfigProposal {
  id: string;
  strategy_name: string;
  description: string;
  is_recommended: boolean;
  panels_count: int;
  installed_kwp: number;
  annual_kwh: number;
  estimated_cost_tnd: number;
  payback_years: number;
  energy_coverage_pct: number;
  placement_score: number;
  orientation: string;
  panels: SamPlacedPanelModel[];
  realistic_render_b64: string;
  tradeoffs: string[];
}

type int = number;

export interface SamRecommendResponse {
  status: string;
  session_id: string;
  recommended_config_id: string;
  proposals: ConfigProposal[];
  processing_time_s: number;
}

export interface SolarSizingResponse {
  location: string;
  annual_consumption_kwh: number;
  specific_yield_kwh_kwp: number;
  yield_source: string;
  panel_wattage_w: number;
  main_configuration: {
    nb_panels: number;
    panel_wattage_w: number;
    installed_kwp: number;
    estimated_production_kwh_year: number;
    coverage_percentage: number;
    required_area_m2: number;
  };
  alternative_configuration: {
    nb_panels: number;
    panel_wattage_w: number;
    installed_kwp: number;
    estimated_production_kwh_year: number;
    coverage_percentage: number;
    required_area_m2: number;
  };
}

export interface SolarFinancialResponse {
  installed_kwp: number;
  cost_breakdown: {
    total_investment_tnd: number;
    modules_cost_tnd: number;
    inverter_cost_tnd: number;
    mounting_cabling_cost_tnd: number;
    labor_connection_cost_tnd: number;
    anme_prosol_subsidy_tnd: number;
    net_investment_after_subsidy_tnd: number;
  };
  roi: {
    investment_tnd: number;
    net_investment_tnd: number;
    annual_savings_tnd: number;
    payback_years: number;
    net_payback_years: number;
    twenty_five_year_net_profit_tnd: number;
    co2_saved_tons_year: number;
    cumulative_cashflow_25y: Array<{ year: number; net_cumulative_tnd: number }>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API Methods
// ─────────────────────────────────────────────────────────────────────────────
export async function calculateSolarSizingApi(params: {
  annualKwh: number;
  location?: string;
  panelWattageW?: number;
  targetCoverage?: number;
}): Promise<SolarSizingResponse> {
  const baseUrl = getBackendBaseUrl();
  const res = await fetch(`${baseUrl}/solar/sizing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      annual_kwh: params.annualKwh,
      location: params.location ?? "Tunis",
      panel_wattage_w: params.panelWattageW ?? 450,
      target_coverage: params.targetCoverage ?? 1.0,
    }),
  });
  if (!res.ok) throw new Error(`Sizing API error: ${res.status}`);
  return await res.json();
}

export async function calculateSolarFinancialApi(params: {
  installedKwp: number;
  annualConsumptionKwh: number;
  location?: string;
  annualBillTnd?: number;
  customCostTnd?: number;
  customTariffTnd?: number;
}): Promise<SolarFinancialResponse> {
  const baseUrl = getBackendBaseUrl();
  const res = await fetch(`${baseUrl}/solar/financial`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      installed_kwp: params.installedKwp,
      annual_consumption_kwh: params.annualConsumptionKwh,
      location: params.location ?? "Tunis",
      annual_bill_tnd: params.annualBillTnd,
      custom_cost_tnd: params.customCostTnd,
      custom_tariff_tnd: params.customTariffTnd,
    }),
  });
  if (!res.ok) throw new Error(`Financial API error: ${res.status}`);
  return await res.json();
}

export async function checkBackendHealth(): Promise<{ healthy: boolean; details?: any }> {
  try {
    const url = `${getBackendBaseUrl()}/roof/health`;
    const res = await fetch(url, { method: "GET" });
    if (res.ok) {
      const json = await res.json();
      return { healthy: json.status === "healthy", details: json };
    }
    return { healthy: false };
  } catch (err) {
    return { healthy: false, details: String(err) };
  }
}

export function getResultImageUrl(sessionId: string): string {
  return `${getBackendBaseUrl()}/roof/result/${sessionId}`;
}

export async function segmentRooftopSam(
  imageB64: string,
  targetPanels: number = 6,
  pointPrompt?: [number, number]
): Promise<SamSegmentResponse> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/roof/segment`;

  const cleanB64 = await ensureImageBase64(imageB64);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_b64: cleanB64,
      target_panels: targetPanels,
      point_prompt: pointPrompt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur segmentation SAM (${res.status}): ${err}`);
  }

  const json: SamSegmentResponse = await res.json();
  json.overlay_b64 = sanitizeDataUri(json.overlay_b64)!;
  if (json.safe_zone_b64) json.safe_zone_b64 = sanitizeDataUri(json.safe_zone_b64)!;
  return json;
}

export async function selectRooftopMask(params: {
  imageB64: string;
  selectedMaskId: number;
  asObstacle?: boolean;
  pointPrompt?: [number, number];
  edgeSetbackM?: number;
}): Promise<SamSelectMaskResponse> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/roof/select-mask`;

  const cleanB64 = await ensureImageBase64(params.imageB64);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_b64: cleanB64,
      selected_mask_id: params.selectedMaskId,
      as_obstacle: params.asObstacle ?? false,
      point_prompt: params.pointPrompt,
      edge_setback_m: params.edgeSetbackM ?? 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur sélection masque (${res.status}): ${err}`);
  }

  const json: SamSelectMaskResponse = await res.json();
  json.overlay_b64 = sanitizeDataUri(json.overlay_b64)!;
  json.safe_zone_b64 = sanitizeDataUri(json.safe_zone_b64)!;
  return json;
}

export async function calibrateRooftop(params: {
  imageB64: string;
  points: [number, number][];
  realWidthM?: number;
  realHeightM?: number;
  refDistanceM?: number;
  refPoints?: [number, number][];
}): Promise<SamCalibrateResponse> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/roof/calibrate`;

  const cleanB64 = await ensureImageBase64(params.imageB64);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_b64: cleanB64,
      points: params.points,
      real_width_m: params.realWidthM,
      real_height_m: params.realHeightM,
      ref_distance_m: params.refDistanceM,
      ref_points: params.refPoints,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur calibration (${res.status}): ${err}`);
  }

  const json: SamCalibrateResponse = await res.json();
  if (json.warped_preview_b64) json.warped_preview_b64 = sanitizeDataUri(json.warped_preview_b64)!;
  return json;
}

export async function getSmartRecommendations(params: {
  imageB64: string;
  roofMaskId?: number;
  obstacleMaskIds?: number[];
  customRoofPolygon?: [number, number][];
  annualKwh?: number;
  monthlyBillTnd?: number;
  maxBudgetTnd?: number;
  panelWattageW?: number;
  realRoofAreaM2?: number;
}): Promise<SamRecommendResponse> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/roof/recommend`;

  const cleanB64 = await ensureImageBase64(params.imageB64);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_b64: cleanB64,
      roof_mask_id: params.roofMaskId,
      obstacle_mask_ids: params.obstacleMaskIds,
      custom_roof_polygon: params.customRoofPolygon,
      annual_kwh: params.annualKwh ?? 2400,
      monthly_bill_tnd: params.monthlyBillTnd,
      max_budget_tnd: params.maxBudgetTnd,
      panel_wattage_w: params.panelWattageW ?? 450,
      real_roof_area_m2: params.realRoofAreaM2,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur recommandations intelligentes (${res.status}): ${err}`);
  }

  const json: SamRecommendResponse = await res.json();
  for (const p of json.proposals) {
    p.realistic_render_b64 = sanitizeDataUri(p.realistic_render_b64)!;
  }
  return json;
}

export async function planRooftopSolar(params: {
  imageB64: string;
  roofMaskId?: number;
  obstacleMaskIds?: number[];
  customRoofPolygon?: [number, number][];
  desiredPanels: number;
  panelWattageW?: number;
  orientation?: "portrait" | "landscape" | "auto";
  edgeSetbackM?: number;
  realRoofAreaM2?: number;
  sunAzimuthDeg?: number;
  sunElevationDeg?: number;
}): Promise<SamPlanResponse> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/roof/plan`;

  const cleanB64 = await ensureImageBase64(params.imageB64);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_b64: cleanB64,
      roof_mask_id: params.roofMaskId,
      obstacle_mask_ids: params.obstacleMaskIds,
      custom_roof_polygon: params.customRoofPolygon,
      desired_panels: params.desiredPanels,
      panel_wattage_w: params.panelWattageW ?? 450,
      orientation: params.orientation ?? "portrait",
      edge_setback_m: params.edgeSetbackM ?? 0.3,
      real_roof_area_m2: params.realRoofAreaM2,
      sun_azimuth_deg: params.sunAzimuthDeg ?? 180.0,
      sun_elevation_deg: params.sunElevationDeg ?? 45.0,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur calepinage solaire (${res.status}): ${err}`);
  }

  const json: SamPlanResponse = await res.json();
  json.realistic_render_b64 = sanitizeDataUri(json.realistic_render_b64)!;
  return json;
}

export async function renderCustomLayout(params: {
  imageB64: string;
  panels: any[];
  roofPolygon?: [number, number][];
  obstacles?: [number, number][][];
  sunAzimuthDeg?: number;
  sunElevationDeg?: number;
}): Promise<{ status: string; realistic_render_b64: string; session_id: string }> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/roof/render`;

  const cleanB64 = await ensureImageBase64(params.imageB64);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_b64: cleanB64,
      panels: params.panels,
      roof_polygon: params.roofPolygon,
      obstacles: params.obstacles,
      sun_azimuth_deg: params.sunAzimuthDeg ?? 180.0,
      sun_elevation_deg: params.sunElevationDeg ?? 45.0,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur rendu personnalisé (${res.status}): ${err}`);
  }

  const json = await res.json();
  json.realistic_render_b64 = sanitizeDataUri(json.realistic_render_b64)!;
  return json;
}

export async function validateRooftopPanels(params: {
  imageWidth: number;
  imageHeight: number;
  roofPolygon: [number, number][];
  obstaclePolygons?: [number, number][][];
  panels: any[];
}): Promise<{
  valid_count: number;
  invalid_count: number;
  total_kwp: number;
  panels: any[];
}> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/roof/validate`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_width: params.imageWidth,
      image_height: params.imageHeight,
      dimensions: [params.imageWidth, params.imageHeight],
      roof_polygon: params.roofPolygon,
      obstacle_polygons: params.obstaclePolygons,
      panels: params.panels,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur validation géométrique (${res.status}): ${err}`);
  }

  return await res.json();
}
