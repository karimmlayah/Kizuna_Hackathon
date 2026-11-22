export type Equipment =
  "Panneaux" | "Maison" | "Batterie" | "Réseau" | "Onduleur";
export interface Bill {
  consumption: number;
  period: string;
  amount: number;
  subscription: string;
}
export interface SolarInput {
  annual: number;
  area: number;
  watts: number;
  location: string;
  roof: string;
}
export interface RoofPanel {
  id: number;
  x: number;
  y: number;
  rotation: number;
}
export interface Inspection {
  id: string;
  date: string;
  uri: string;
  demo: true;
}
export interface SavedRooftopProject {
  id: string;
  name: string;
  date: string;
  photoUri?: string;
  panelsCount: number;
  capacityKwp: number;
  annualKwh: number;
  costTnd: number;
  savingsTnd: number;
  roiYears: number;
  mode: "ai" | "manual";
  panels: any[];
}
