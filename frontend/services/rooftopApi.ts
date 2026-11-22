import { Platform } from "react-native";

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

// ─────────────────────────────────────────────────────────────────────────────
// Legacy & Common Types
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

// ─────────────────────────────────────────────────────────────────────────────
// Meta SAM ViT-B & Placement Engine Types
// ─────────────────────────────────────────────────────────────────────────────
export interface SamMaskInfo {
  id: intId;
  area: number;
  area_pct: number;
  bbox: [number, number, number, number];
  stability_score: number;
  predicted_iou: number;
  is_roof_candidate: boolean;
  is_obstacle: boolean;
  polygon: [number, number][];
}
type intId = number;

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
  processing_time_s: number;
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
  dimensions: [number, number];
  roof_polygon: [number, number][];
  obstacle_polygons: [number, number][][];
  panels_requested: number;
  panels_placed: number;
  all_fitted: boolean;
  installed_kwp: number;
  panel_wattage_w: number;
  panels: SamPlacedPanelModel[];
  calibration_method: string;
  realistic_render_b64: string;
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

/**
 * Perform SAM ViT-B rooftop segmentation.
 */
export async function segmentRooftopSam(
  imageB64: string,
  targetPanels: number = 6,
  pointPrompt?: [number, number]
): Promise<SamSegmentResponse> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/roof/segment`;

  const cleanB64 = imageB64.includes(",") ? imageB64.split(",")[1] : imageB64;

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

  return await res.json();
}

/**
 * Plan solar layout and generate photorealistic photovoltaic render.
 */
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
}): Promise<SamPlanResponse> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/roof/plan`;

  const cleanB64 = params.imageB64.includes(",")
    ? params.imageB64.split(",")[1]
    : params.imageB64;

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
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur calepinage solaire (${res.status}): ${err}`);
  }

  return await res.json();
}

/**
 * Validate manual panel placement constraints.
 */
export async function validateRooftopPanels(params: {
  imageWidth: number;
  imageHeight: number;
  roofPolygon: [number, number][];
  obstaclePolygons?: [number, number][][];
  panels: any[];
}): Promise<{
  all_valid: boolean;
  total_panels: number;
  valid_panels: number;
  invalid_panels: string[];
  panels: Array<{ id: string; is_valid: boolean; warning?: string }>;
}> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/roof/validate`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_width: params.imageWidth,
      image_height: params.imageHeight,
      roof_polygon: params.roofPolygon,
      obstacle_polygons: params.obstaclePolygons,
      panels: params.panels,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur validation toiture (${res.status}): ${err}`);
  }

  return await res.json();
}

/**
 * Deterministic Solar Sizing API.
 */
export async function calculateSolarSizingApi(params: {
  annualKwh: number;
  location: string;
  panelWattageW?: number;
  targetCoverage?: number;
}): Promise<SolarSizingResponse> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/solar/sizing`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      annual_kwh: params.annualKwh,
      location: params.location,
      panel_wattage_w: params.panelWattageW ?? 450,
      target_coverage: params.targetCoverage ?? 1.0,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur calcul dimensionnement (${res.status}): ${err}`);
  }

  return await res.json();
}

/**
 * Deterministic Solar Financial API.
 */
export async function calculateSolarFinancialApi(params: {
  installedKwp: number;
  annualConsumptionKwh: number;
  annualProductionKwh?: number;
  location?: string;
  annualBillTnd?: number;
  customCostTnd?: number;
  customTariffTnd?: number;
  selfConsumptionRate?: number;
}): Promise<SolarFinancialResponse> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/solar/financial`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      installed_kwp: params.installedKwp,
      annual_consumption_kwh: params.annualConsumptionKwh,
      annual_production_kwh: params.annualProductionKwh,
      location: params.location ?? "Tunis",
      annual_bill_tnd: params.annualBillTnd,
      custom_cost_tnd: params.customCostTnd,
      custom_tariff_tnd: params.customTariffTnd,
      self_consumption_rate: params.selfConsumptionRate ?? 0.85,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur calcul financier (${res.status}): ${err}`);
  }

  return await res.json();
}

/**
 * Legacy / U-Net Rooftop Analysis (kept for backwards compatibility)
 */
export async function analyzeRooftopImage(
  imageUriOrBase64: string,
  options?: {
    declaredArea?: number;
    targetPanels?: number;
    panelPowerKwp?: number;
    obstacles?: any[];
  }
): Promise<RooftopAnalysisResponse> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/api/rooftop/analyze`;

  if (imageUriOrBase64.startsWith("data:") || imageUriOrBase64.length > 500) {
    const jsonUrl = `${baseUrl}/api/rooftop/analyze-json`;
    const res = await fetch(jsonUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_base64: imageUriOrBase64,
        declared_area_m2: options?.declaredArea,
        target_panels: options?.targetPanels,
        panel_power_kwp: options?.panelPowerKwp || 0.40,
        obstacles: options?.obstacles,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Erreur serveur IA (${res.status}): ${err}`);
    }
    return await res.json();
  }

  const formData = new FormData();
  if (Platform.OS === "web") {
    const blobRes = await fetch(imageUriOrBase64);
    const blob = await blobRes.blob();
    formData.append("file", blob, "roof.jpg");
  } else {
    formData.append("file", {
      uri: imageUriOrBase64,
      name: "roof.jpg",
      type: "image/jpeg",
    } as any);
  }

  formData.append(
    "data_json",
    JSON.stringify({
      declared_area_m2: options?.declaredArea,
      target_panels: options?.targetPanels,
      panel_power_kwp: options?.panelPowerKwp || 0.40,
      obstacles: options?.obstacles,
    })
  );

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur analyse toiture (${res.status}): ${err}`);
  }

  return await res.json();
}

export async function askAiAdvisor(
  panels: PlacedPanel[],
  options?: {
    targetPanels?: number;
    panelPowerKwp?: number;
    maskBase64?: string;
  }
): Promise<AiAdviseResponse> {
  const url = `${getBackendBaseUrl()}/api/rooftop/advise`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      panels,
      target_panels: options?.targetPanels ?? 10,
      panel_power_kwp: options?.panelPowerKwp ?? 0.40,
      mask_base64: options?.maskBase64,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur conseiller IA (${res.status}): ${err}`);
  }

  return await res.json();
}
