import type { Bill, SolarInput } from "../types";
// Contracts only. No network adapters, credentials, OCR or real telemetry in this phase.
export interface BillAnalysisService {
  analyze(uri: string): Promise<{ bill: Partial<Bill>; confidence: number }>;
}
export interface RoofVisionService {
  segment(
    uri: string,
  ): Promise<{ polygon: [number, number][]; scaleMetersPerPixel?: number }>;
}
export interface EnergyService {
  subscribe(
    listener: (data: {
      production: number;
      consumption: number;
      timestamp: string;
    }) => void,
  ): () => void;
}
export interface SizingService {
  recommend(input: SolarInput): Promise<{ panels: number; kwp: number }>;
}
export interface MaintenanceService {
  inspect(uri:string):Promise<{findings:{label:string;confidence:number;box:[number,number,number,number]}[];reviewRequired:boolean}>;
}
