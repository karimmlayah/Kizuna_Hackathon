import React, {
  Suspense,
  useRef,
  useState,
  useEffect,
  useMemo,
  Component,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";
import { View } from "react-native";
import Fallback from "./SolarScene.native";
import { useMotion } from "../hooks/useMotion";
import type { SceneProps } from "./SolarScene.types";
import type { Equipment } from "../types";

// Static shared unit box geometry to eliminate GPU memory churn
const UNIT_BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const SPHERE_GEO = new THREE.SphereGeometry(0.055, 8, 8);
const TRUNK_GEO = new THREE.CylinderGeometry(0.06, 0.1, 1.1, 8);
const FOLIAGE_GEO_1 = new THREE.IcosahedronGeometry(0.7, 2);
const FOLIAGE_GEO_2 = new THREE.IcosahedronGeometry(1, 1);

// Static energy flow paths
const FLOW_SOLAR_POINTS = [
  new THREE.Vector3(-0.6, 2.7, 0),
  new THREE.Vector3(0.4, 2, 1.35),
  new THREE.Vector3(0.4, 0.7, 1.5),
];
const FLOW_BATTERY_POINTS = [
  new THREE.Vector3(0.4, 0.5, 1.5),
  new THREE.Vector3(0.65, 0.3, 1.9),
  new THREE.Vector3(0.95, 0.65, 1.8),
];
const FLOW_GRID_POINTS = [
  new THREE.Vector3(0.4, 0.3, 1.5),
  new THREE.Vector3(1.7, 0.14, 2.6),
  new THREE.Vector3(3.3, 0.5, 2.45),
];

function Box({
  p,
  size,
  color,
  metal = 0,
  select,
}: {
  p: [number, number, number];
  size: [number, number, number];
  color: string;
  metal?: number;
  select?: () => void;
}) {
  return (
    <mesh
      position={p}
      scale={size}
      geometry={UNIT_BOX_GEO}
      castShadow
      receiveShadow
      onClick={(e) => {
        if (select) {
          e.stopPropagation();
          select();
        }
      }}
    >
      <meshStandardMaterial color={color} roughness={0.65} metalness={metal} />
    </mesh>
  );
}

function Controls() {
  const { camera, gl } = useThree();
  useEffect(() => {
    if (!gl?.domElement) return;
    const c = new OrbitControls(camera, gl.domElement);
    c.enablePan = false;
    c.minDistance = 8;
    c.maxDistance = 16;
    c.minPolarAngle = 0.5;
    c.maxPolarAngle = 1.35;
    c.minAzimuthAngle = -0.5;
    c.maxAzimuthAngle = 1.7;
    c.target.set(0, 0.5, 0);
    return () => {
      try {
        c.dispose();
      } catch {}
    };
  }, [camera, gl]);
  return null;
}

function Framing() {
  const { camera, size } = useThree();
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.zoom = Math.min(1, Math.max(0.65, size.width / Math.max(1, size.height)));
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height]);
  return null;
}

export function EnergyFlow({
  points,
  color,
  motion,
  intensity,
}: {
  points: THREE.Vector3[];
  color: string;
  motion: boolean;
  intensity: number;
}) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const tubeGeo = useMemo(
    () => new THREE.TubeGeometry(curve, 20, 0.018, 5, false),
    [curve],
  );
  const ref = useRef<THREE.Group>(null);
  const tRef = useRef(0);

  useFrame((_, delta) => {
    if (!motion || !ref.current) return;
    tRef.current = (tRef.current + delta * 0.45 * intensity) % 1;
    const t = tRef.current;
    const children = ref.current.children;
    for (let i = 0; i < children.length; i++) {
      const p = curve.getPoint((t + i / 4) % 1);
      children[i]?.position.copy(p);
    }
  });

  return (
    <group>
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
        />
      </mesh>
      <group ref={ref}>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            position={curve.getPoint(i / 4)}
            geometry={SPHERE_GEO}
          >
            <meshBasicMaterial color={color} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function House({
  night,
  onSelect,
  intensity = 1,
  motion,
}: SceneProps & { motion: boolean }) {
  const choose = (s: Equipment) => () => onSelect?.(s);
  const glass = night ? "#FFB800" : "#FFE599";
  return (
    <group rotation={[0, -0.12, 0]}>
      <Box
        p={[0, -0.18, 0]}
        size={[8, 0.3, 6.7]}
        color={night ? "#162231" : "#EFE8D6"}
      />
      <Box p={[0, -0.01, 0]} size={[5.5, 0.12, 4.6]} color={night ? "#1B2A3C" : "#E5DDCB"} />
      <Box
        p={[-0.4, 0.9, -0.35]}
        size={[3.9, 1.8, 3]}
        color={night ? "#203043" : "#FAF6EE"}
        select={choose("Maison")}
      />
      <Box p={[-0.7, 2.1, -0.65]} size={[3.3, 0.65, 2.8]} color={night ? "#26394F" : "#FFFDF8"} />
      <Box p={[-0.7, 2.48, -0.65]} size={[3.6, 0.14, 3.1]} color={night ? "#17212E" : "#E2D9C8"} />
      <Box p={[1.65, 0.57, 0.05]} size={[1.9, 1.14, 2.8]} color={night ? "#1E2C3D" : "#F4EFE4"} />
      <Box p={[1.65, 1.18, 0.05]} size={[2.1, 0.14, 3]} color={night ? "#25364A" : "#FDFBF7"} />
      <Box p={[1.65, 0.52, 1.465]} size={[1.5, 0.87, 0.04]} color="#7E7260" />
      {Array.from({ length: 6 }, (_, i) => (
        <Box
          key={i}
          p={[1.65, 0.2 + i * 0.13, 1.49]}
          size={[1.48, 0.015, 0.02]}
          color="#B8A992"
        />
      ))}
      <Box
        p={[-0.65, 1.1, 1.166]}
        size={[2.7, 1.05, 0.03]}
        color={glass}
        metal={0.4}
      />
      {[-1.85, -0.65, 0.65].map((x) => (
        <Box
          key={x}
          p={[x, 1.1, 1.2]}
          size={[0.045, 1.13, 0.06]}
          color="#475569"
        />
      ))}
      <Box
        p={[-2.365, 1, -0.65]}
        size={[0.03, 1, 1.7]}
        color={glass}
        metal={0.4}
      />
      <Box
        p={[-0.8, 2.12, 0.765]}
        size={[2.8, 0.32, 0.04]}
        color={glass}
        metal={0.4}
      />
      <Box p={[-0.7, 0.14, 1.8]} size={[3.5, 0.2, 1.1]} color="#C5B295" />
      {Array.from({ length: 14 }, (_, i) => (
        <Box
          key={i}
          p={[-2.3 + i * 0.24, 0.245, 1.8]}
          size={[0.015, 0.01, 1.1]}
          color="#AB987B"
        />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <group
          key={i}
          position={[
            -1.97 + (i % 4) * 0.82,
            2.61,
            -1.63 + Math.floor(i / 4) * 0.92,
          ]}
          rotation={[-0.12, 0, 0]}
        >
          <Box
            p={[0, 0, 0]}
            size={[0.74, 0.065, 0.81]}
            color={night ? "#070E18" : "#0A1420"}
            metal={0.7}
            select={choose("Panneaux")}
          />
          {[-0.23, 0, 0.23].map((x) => (
            <Box
              key={x}
              p={[x, 0.035, 0]}
              size={[0.008, 0.008, 0.78]}
              color="#38BDF8"
            />
          ))}
          {[-0.25, 0, 0.25].map((z) => (
            <Box
              key={z}
              p={[0, 0.036, z]}
              size={[0.7, 0.008, 0.008]}
              color="#38BDF8"
            />
          ))}
        </group>
      ))}
      <Box
        p={[0.93, 0.68, 1.65]}
        size={[0.37, 0.95, 0.22]}
        color="#FFFFFF"
        select={choose("Batterie")}
      />
      <Box p={[0.93, 0.94, 1.77]} size={[0.18, 0.04, 0.02]} color="#10B981" />
      <Box
        p={[0.4, 0.65, 1.26]}
        size={[0.3, 0.45, 0.16]}
        color="#F8FAFC"
        select={choose("Onduleur")}
      />
      <Box p={[2.15, 0.02, 2.6]} size={[1.7, 0.08, 1.8]} color={night ? "#1A2534" : "#E2DACB"} />
      <Box
        p={[3.3, 0.5, 2.45]}
        size={[0.33, 0.95, 0.3]}
        color="#475569"
        select={choose("Réseau")}
      />
      {[
        [-3.1, 1.5],
        [-3.2, -2],
        [2.9, -2.2],
      ].map(([x, z], i) => (
        <group key={i} position={[x!, 0, z!]}>
          <mesh position={[0, 0.55, 0]} geometry={TRUNK_GEO} castShadow>
            <meshStandardMaterial color="#8D8166" />
          </mesh>
          <mesh
            position={[0, 1.2, 0]}
            geometry={FOLIAGE_GEO_1}
            castShadow
            scale={[0.65, 1, 0.65]}
          >
            <meshStandardMaterial
              color={night ? "#1E3A2F" : (i % 2 ? "#7A9A70" : "#8BAF7F")}
              roughness={0.9}
            />
          </mesh>
        </group>
      ))}
      {[-2.6, -1.7, -0.8].map((x) => (
        <mesh
          key={x}
          position={[x, 0.16, 2.8]}
          geometry={FOLIAGE_GEO_2}
          castShadow
          scale={[0.35, 0.2, 0.3]}
        >
          <meshStandardMaterial color={night ? "#1E3A2F" : "#8AA97F"} />
        </mesh>
      ))}
      <EnergyFlow
        points={FLOW_SOLAR_POINTS}
        color="#FFB800"
        motion={motion}
        intensity={night ? 0.15 : intensity}
      />
      <EnergyFlow
        points={FLOW_BATTERY_POINTS}
        color="#10B981"
        motion={motion}
        intensity={intensity}
      />
      <EnergyFlow
        points={FLOW_GRID_POINTS}
        color="#38BDF8"
        motion={motion}
        intensity={intensity}
      />
    </group>
  );
}

class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: any) {
    console.warn("SolarWorld WebGL render error caught by boundary:", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function SolarWorld(props: SceneProps & { active?: boolean }) {
  const motion = useMotion();
  const [visible, setVisible] = useState(true);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const fn = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", fn);
    return () => document.removeEventListener("visibilitychange", fn);
  }, []);

  if (lost) return <Fallback {...props} />;

  return (
    <View style={{ flex: 1, minHeight: 320 }}>
      <Boundary fallback={<Fallback {...props} />}>
        <Suspense fallback={<Fallback {...props} />}>
          <Canvas
            shadows="soft"
            dpr={[1, 1.5]}
            frameloop={motion && visible && props.active !== false ? "always" : "demand"}
            camera={{ position: [8, 7.5, 10], fov: 35 }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
            }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener(
                "webglcontextlost",
                (e) => {
                  e.preventDefault();
                  setLost(true);
                },
                { once: true },
              );
            }}
          >
            <ambientLight intensity={props.night ? 0.6 : 2.0} />
            <directionalLight
              position={props.night ? [-4, 8, -5] : [4, 8, 4]}
              intensity={props.night ? 1.2 : 3.5}
              color={props.night ? "#7EA8D6" : "#FFF5E0"}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-camera-left={-6}
              shadow-camera-right={6}
              shadow-camera-top={6}
              shadow-camera-bottom={-6}
            />
            <House {...props} motion={motion && visible && props.active !== false} />
            <Controls />
            <Framing />
          </Canvas>
        </Suspense>
      </Boundary>
    </View>
  );
}
