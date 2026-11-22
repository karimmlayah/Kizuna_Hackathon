import type { Equipment } from "../types";
export interface SceneProps {
  night: boolean;
  intensity?: number;
  onSelect?: (equipment: Equipment) => void;
}
