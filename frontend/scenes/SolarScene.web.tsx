import React, {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  Component,
  type ReactNode,
} from "react";
import Fallback from "./SolarScene.native";
import type { SceneProps } from "./SolarScene.types";

const World = lazy(() => import("./SolarWorld.web"));

function checkWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

class SafeBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.warn("SolarScene fallback to vector 2D:", err?.message || err);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export default function SolarScene(props: SceneProps) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(checkWebGLSupport());
    if (!root.current || typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry?.isIntersecting ?? false),
      { threshold: 0.05 },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  const forceSafe =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("graphics") === "safe";

  return (
    <div
      ref={root}
      style={{ display: "flex", flex: 1, minHeight: 300, width: "100%" }}
    >
      <SafeBoundary fallback={<Fallback {...props} />}>
        <Suspense fallback={<Fallback {...props} />}>
          {active && supported && !forceSafe ? (
            <World {...props} active={active} />
          ) : (
            <Fallback {...props} />
          )}
        </Suspense>
      </SafeBoundary>
    </div>
  );
}
