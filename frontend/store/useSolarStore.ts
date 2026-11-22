import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SolarInput, RoofPanel, Inspection, SavedRooftopProject } from "../types";
import type { RooftopAnalysisResponse, PlacedPanel } from "../services/rooftopApi";

export interface PanelModel {
  name: string;
  power_w: number;
  width_m: number;
  height_m: number;
}

export const PANEL_LIBRARY: PanelModel[] = [
  { name: "Standard 400W Monocristallin", power_w: 400, width_m: 1.0, height_m: 1.72 },
  { name: "Haute Efficacité 450W Bifacial", power_w: 450, width_m: 1.05, height_m: 1.76 },
  { name: "Compact 350W Résidentiel", power_w: 350, width_m: 0.98, height_m: 1.64 },
];

interface State {
  name: string;
  night: boolean;
  reduced: boolean;
  onboarded: boolean;
  input: SolarInput;
  panels: RoofPanel[];
  inspections: Inspection[];
  // Rooftop Studio State
  rooftopPhoto: string | null;
  activeMode: "ai" | "manual";
  analyzing: boolean;
  analysisResult: RooftopAnalysisResponse | null;
  manualPanels: PlacedPanel[];
  selectedPanelId: string | null;
  showMask: boolean;
  showContours: boolean;
  panelModel: PanelModel;
  savedProjects: SavedRooftopProject[];
  undoStack: PlacedPanel[][];
  redoStack: PlacedPanel[][];
  cinematicSplashRequested: boolean;
  triggerCinematicSplash: () => void;
  set: (patch: Partial<Omit<State, "set">>) => void;
}

export const useSolarStore = create<State>()(
  persist(
    (set) => ({
      name: "Amine",
      night: false,
      reduced: false,
      onboarded: false,
      cinematicSplashRequested: false,
      triggerCinematicSplash: () => set({ cinematicSplashRequested: true }),
      input: {
        annual: 7200,
        area: 45,
        watts: 450,
        location: "Tunis",
        roof: "Terrasse",
      },
      panels: Array.from({ length: 8 }, (_, i) => ({
        id: i,
        x: 24 + (i % 4) * 12,
        y: 30 + Math.floor(i / 4) * 23,
        rotation: 0,
      })),
      inspections: [],
      // Rooftop Studio initial state
      rooftopPhoto: null,
      activeMode: "ai",
      analyzing: false,
      analysisResult: null,
      manualPanels: [],
      selectedPanelId: null,
      showMask: false,
      showContours: true,
      panelModel: PANEL_LIBRARY[0] as PanelModel,
      savedProjects: [],
      undoStack: [],
      redoStack: [],
      set: (patch) => set(patch),
    }),
    { name: "smart-solar-v2-rooftop", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
