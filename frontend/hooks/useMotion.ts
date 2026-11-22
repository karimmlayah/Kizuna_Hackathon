import { useEffect, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { useSolarStore } from "../store/useSolarStore";
export function useMotion() {
  const reduced = useSolarStore((s) => s.reduced);
  const [system, setSystem] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSystem);
    const a = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setSystem,
    );
    const b = AppState.addEventListener("change", (s) =>
      setActive(s === "active"),
    );
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return !reduced && !system && active;
}
