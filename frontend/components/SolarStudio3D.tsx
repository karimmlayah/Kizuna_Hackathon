import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import * as THREE from "three";
import {
  Play,
  RotateCcw,
  Sun,
  Eye,
  Sliders,
  Sparkles,
  Info,
  Maximize2,
  CheckCircle2,
} from "lucide-react-native";
import type { PlacedPanel } from "../services/rooftopApi";

interface SolarStudio3DProps {
  panels: PlacedPanel[];
  roofPolygon?: [number, number][];
  tiltAngleDeg?: number; // 0, 15, 25, 30
  panelWattageW?: number;
  onPanelSelect?: (id: string) => void;
  selectedPanelId?: string | null;
}

export function SolarStudio3D({
  panels,
  roofPolygon,
  tiltAngleDeg = 20,
  panelWattageW = 450,
  onPanelSelect,
  selectedPanelId,
}: SolarStudio3DProps) {
  const { width } = useWindowDimensions();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Simulation controls state
  const [hourOfDay, setHourOfDay] = useState<number>(13.5); // 13h30 (peak sun)
  const [season, setSeason] = useState<"summer" | "equinox" | "winter">("summer");
  const [isAssembling, setIsAssembling] = useState<boolean>(false);
  const [assemblyProgress, setAssemblyProgress] = useState<number>(1.0); // 0.0 to 1.0 (1 = fully built)
  const [activeCamPreset, setActiveCamPreset] = useState<"iso" | "top" | "front">("iso");

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const sunSphereRef = useRef<THREE.Mesh | null>(null);
  const panelMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const racksGroupRef = useRef<THREE.Group | null>(null);
  const inverterMeshRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);

  // Mouse / Touch orbit control state
  const isDragging = useRef(false);
  const prevMousePos = useRef({ x: 0, y: 0 });
  const orbitAngle = useRef({ theta: Math.PI / 4, phi: Math.PI / 3, radius: 24 });

  // Calculate astronomical sun position for Tunis (Latitude 36.8°N)
  const sunCoords = useMemo(() => {
    const lat = 36.8 * (Math.PI / 180);
    const declinationMap = {
      summer: 23.45 * (Math.PI / 180),
      equinox: 0.0,
      winter: -23.45 * (Math.PI / 180),
    };
    const delta = declinationMap[season];
    const hourAngle = (hourOfDay - 12) * 15 * (Math.PI / 180);

    // Elevation (sin alpha)
    const sinAlpha =
      Math.sin(lat) * Math.sin(delta) +
      Math.cos(lat) * Math.cos(delta) * Math.cos(hourAngle);
    const elevation = Math.max(0.05, Math.asin(Math.max(-1, Math.min(1, sinAlpha))));

    // Azimuth
    const cosAzimuth =
      (Math.sin(delta) - Math.sin(lat) * sinAlpha) /
      (Math.cos(lat) * Math.cos(elevation) + 0.0001);
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth)));
    if (hourAngle > 0) azimuth = 2 * Math.PI - azimuth;

    const sunDistance = 32;
    const x = sunDistance * Math.cos(elevation) * Math.sin(azimuth);
    const y = sunDistance * Math.sin(elevation);
    const z = sunDistance * Math.cos(elevation) * Math.cos(azimuth);

    return { x, y, z, elevationDeg: Math.round((elevation * 180) / Math.PI) };
  }, [hourOfDay, season]);

  // Update Three.js camera position according to orbit spherical coordinates
  const updateCameraFromOrbit = useCallback(() => {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = orbitAngle.current;
    const clampedPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, phi));

    cameraRef.current.position.x = radius * Math.sin(clampedPhi) * Math.sin(theta);
    cameraRef.current.position.y = radius * Math.cos(clampedPhi);
    cameraRef.current.position.z = radius * Math.sin(clampedPhi) * Math.cos(theta);
    cameraRef.current.lookAt(0, 1.5, 0);
  }, []);

  // Initialize Three.js Scene (Web only / Canvas)
  useEffect(() => {
    if (Platform.OS !== "web" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 420;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1724); // Midnight 3D ambient
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    cameraRef.current = camera;
    updateCameraFromOrbit();

    // 2. WebGL Renderer with Shadows
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(w, h, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // 3. Lighting (Ambient + Dynamic Directional Sun Light)
    const ambientLight = new THREE.AmbientLight(0xfff6ea, 0.55);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffe09e, 1.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 60;
    sunLight.shadow.camera.left = -16;
    sunLight.shadow.camera.right = 16;
    sunLight.shadow.camera.top = 16;
    sunLight.shadow.camera.bottom = -16;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Sun glowing visual orb
    const sunSphereGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const sunSphereMat = new THREE.MeshBasicMaterial({ color: 0xffb800 });
    const sunSphere = new THREE.Mesh(sunSphereGeo, sunSphereMat);
    scene.add(sunSphere);
    sunSphereRef.current = sunSphere;

    // 4. Procedural Mediterranean House & Roof Geometry
    const houseGroup = new THREE.Group();

    // Main House Body (White / Cream Mediterranean Villa)
    const houseMat = new THREE.MeshStandardMaterial({
      color: 0xf3ede2,
      roughness: 0.65,
      metalness: 0.1,
    });
    const houseGeo = new THREE.BoxGeometry(14, 5, 11);
    const houseMesh = new THREE.Mesh(houseGeo, houseMat);
    houseMesh.position.y = 2.5;
    houseMesh.castShadow = true;
    houseMesh.receiveShadow = true;
    houseGroup.add(houseMesh);

    // Flat Roof Slab (Terrasse)
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xded5c6,
      roughness: 0.75,
      metalness: 0.05,
    });
    const roofGeo = new THREE.BoxGeometry(14.6, 0.4, 11.6);
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.y = 5.2;
    roofMesh.receiveShadow = true;
    houseGroup.add(roofMesh);

    // Parapet Rim (Acotère de sécurité)
    const parapetMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.7 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.5, 0.3), parapetMat);
    p1.position.set(0, 5.5, 5.7);
    const p2 = p1.clone();
    p2.position.set(0, 5.5, -5.7);
    const p3 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 11.6), parapetMat);
    p3.position.set(7.2, 5.5, 0);
    const p4 = p3.clone();
    p4.position.set(-7.2, 5.5, 0);
    p1.receiveShadow = true;
    p2.receiveShadow = true;
    p3.receiveShadow = true;
    p4.receiveShadow = true;
    houseGroup.add(p1, p2, p3, p4);

    // Chimney Obstacle
    const chimneyMat = new THREE.MeshStandardMaterial({ color: 0xb94e38, roughness: 0.8 });
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.2), chimneyMat);
    chimney.position.set(-4.2, 6.0, -2.5);
    chimney.castShadow = true;
    chimney.receiveShadow = true;
    houseGroup.add(chimney);

    // Large Panoramic Facade Window (Golden Interior Warmth)
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xffaa22,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.8,
    });
    const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.8), windowMat);
    windowMesh.position.set(0, 2.6, 5.52);
    houseGroup.add(windowMesh);

    // Ground plane
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1b2838,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(45, 45), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    houseGroup.add(ground);

    scene.add(houseGroup);

    // Group for mounting racks and structures
    const racksGroup = new THREE.Group();
    scene.add(racksGroup);
    racksGroupRef.current = racksGroup;

    // Hybrid Inverter on wall
    const inverterMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.8,
      roughness: 0.25,
    });
    const inverter = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.4), inverterMat);
    inverter.position.set(5.5, 3.2, 5.55);
    inverter.castShadow = true;
    scene.add(inverter);
    inverterMeshRef.current = inverter;

    // Energy photon particles from panels to inverter
    const particleCount = 45;
    const particleGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 8;
      posArray[i + 1] = 5.4 + Math.random() * 0.4;
      posArray[i + 2] = (Math.random() - 0.5) * 6;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.18,
      color: 0xffb800,
      transparent: true,
      opacity: 0.85,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    particlesRef.current = particles;

    // 5. Animation Render Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Animate photon particles
      if (particlesRef.current) {
        const positions = particlesRef.current.geometry.attributes.position!.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
          // Flow gently toward inverter at (5.5, 3.2, 5.55)
          positions[i]! += (5.5 - positions[i]!) * 0.015;
          positions[i + 1]! += (3.2 - positions[i + 1]!) * 0.015;
          positions[i + 2]! += (5.55 - positions[i + 2]!) * 0.015;
          if (Math.abs(positions[i]! - 5.5) < 0.3) {
            positions[i] = (Math.random() - 0.5) * 8;
            positions[i + 1] = 5.5;
            positions[i + 2] = (Math.random() - 0.5) * 6;
          }
        }
        particlesRef.current.geometry.attributes.position!.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [updateCameraFromOrbit]);

  // Update Sun Light Position & Shadow Direction
  useEffect(() => {
    if (!sunLightRef.current || !sunSphereRef.current) return;
    const { x, y, z } = sunCoords;

    sunLightRef.current.position.set(x, y, z);
    sunSphereRef.current.position.set(x, y, z);

    // Warm golden color at dawn/dusk, bright solar at noon
    const sunColor = hourOfDay < 9 || hourOfDay > 17 ? 0xff8a00 : 0xffe09e;
    sunLightRef.current.color.setHex(sunColor);
  }, [sunCoords, hourOfDay]);

  // Sync Panels with 2D Layout & Assembly Step
  useEffect(() => {
    if (!sceneRef.current || !racksGroupRef.current) return;
    const scene = sceneRef.current;
    const racksGroup = racksGroupRef.current;

    // Clear existing panel meshes
    panelMeshesRef.current.forEach((mesh) => scene.remove(mesh));
    panelMeshesRef.current.clear();
    while (racksGroup.children.length > 0) {
      racksGroup.remove(racksGroup.children[0]!);
    }

    const roofWidth3D = 13.0;
    const roofDepth3D = 10.0;
    const roofY = 5.42;

    const tiltRad = (tiltAngleDeg * Math.PI) / 180;

    panels.forEach((p, index) => {
      // Map 2D percentage coords [2..98%] to 3D roof plane [-roofWidth/2 .. +roofWidth/2]
      const posX3D = ((p.x_pct - 50) / 100) * roofWidth3D;
      const posZ3D = ((p.y_pct - 50) / 100) * roofDepth3D;

      // Assembly progress check: panels appear sequentially
      const panelThreshold = index / Math.max(panels.length, 1);
      if (assemblyProgress < panelThreshold) return;

      const pGroup = new THREE.Group();
      pGroup.position.set(posX3D, roofY, posZ3D);

      // Panel Dimensions in 3D units (standard 1.05m x 1.76m module)
      const pW = 1.05;
      const pH = 1.76;

      // 1. Tilted Aluminum Frame
      const frameMat = new THREE.MeshStandardMaterial({
        color: p.id === selectedPanelId ? 0xffb800 : 0x222a36,
        roughness: 0.35,
        metalness: 0.85,
      });
      const frameGeo = new THREE.BoxGeometry(pW, 0.05, pH);
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.rotation.x = -tiltRad;
      frameMesh.castShadow = true;
      frameMesh.receiveShadow = true;
      pGroup.add(frameMesh);

      // 2. Monocrystalline Silicon Photovoltaic Surface (Deep Navy/Black)
      const siliconMat = new THREE.MeshStandardMaterial({
        color: 0x0a1424,
        roughness: 0.15,
        metalness: 0.9,
      });
      const siliconGeo = new THREE.BoxGeometry(pW - 0.06, 0.02, pH - 0.06);
      const siliconMesh = new THREE.Mesh(siliconGeo, siliconMat);
      siliconMesh.position.y = 0.025;
      siliconMesh.rotation.x = -tiltRad;
      pGroup.add(siliconMesh);

      // 3. Mounting Bracket Struts (Supports triangulaires en aluminium)
      if (assemblyProgress >= 0.25) {
        const strutMat = new THREE.MeshStandardMaterial({ color: 0x8894a0, metalness: 0.9, roughness: 0.2 });
        const strutHeight = Math.sin(tiltRad) * (pH / 2);
        const strutGeo = new THREE.CylinderGeometry(0.02, 0.02, strutHeight, 8);
        const strut1 = new THREE.Mesh(strutGeo, strutMat);
        strut1.position.set(-pW / 2 + 0.1, strutHeight / 2, -pH / 4);
        const strut2 = strut1.clone();
        strut2.position.set(pW / 2 - 0.1, strutHeight / 2, -pH / 4);
        pGroup.add(strut1, strut2);
      }

      scene.add(pGroup);
      panelMeshesRef.current.set(p.id, pGroup);
    });
  }, [panels, tiltAngleDeg, selectedPanelId, assemblyProgress]);

  // Cinematic Assembly Animation Controller
  const startAssemblySequence = () => {
    setIsAssembling(true);
    setAssemblyProgress(0.0);

    const startTime = performance.now();
    const duration = 4000; // 4 seconds total

    const step = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      setAssemblyProgress(progress);

      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        setIsAssembling(false);
      }
    };
    requestAnimationFrame(step);
  };

  // Preset Camera Views
  const setCameraPreset = (preset: "iso" | "top" | "front") => {
    setActiveCamPreset(preset);
    if (preset === "iso") {
      orbitAngle.current = { theta: Math.PI / 4, phi: Math.PI / 3.2, radius: 24 };
    } else if (preset === "top") {
      orbitAngle.current = { theta: 0, phi: 0.12, radius: 22 };
    } else if (preset === "front") {
      orbitAngle.current = { theta: 0, phi: Math.PI / 2.3, radius: 25 };
    }
    updateCameraFromOrbit();
  };

  // Mouse / Touch Event Handlers for Orbit Rotation & Zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    prevMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - prevMousePos.current.x;
    const dy = e.clientY - prevMousePos.current.y;
    prevMousePos.current = { x: e.clientX, y: e.clientY };

    orbitAngle.current.theta -= dx * 0.008;
    orbitAngle.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, orbitAngle.current.phi - dy * 0.008));
    updateCameraFromOrbit();
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    orbitAngle.current.radius = Math.max(10, Math.min(42, orbitAngle.current.radius + e.deltaY * 0.03));
    updateCameraFromOrbit();
  };

  return (
    <View style={styles.container}>
      {/* 3D Canvas Viewport */}
      <View style={styles.canvasWrapper}>
        {Platform.OS === "web" ? (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            style={{ width: "100%", height: 420, display: "block", cursor: "grab" }}
          />
        ) : (
          <View style={styles.mobilePlaceholder}>
            <Text style={{ color: "#FFFDF7", fontWeight: "700" }}>
              Solar Studio 360° optimisé pour Web / Desktop
            </Text>
          </View>
        )}

        {/* Floating Top HUD: Presets & Stats */}
        <View style={styles.topHud}>
          {/* Camera Viewpoints */}
          <View style={styles.hudPill}>
            {[
              { id: "iso", label: "Isométrique 45°" },
              { id: "top", label: "Aérienne 90°" },
              { id: "front", label: "Façade 20°" },
            ].map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setCameraPreset(p.id as any)}
                style={[
                  styles.presetBtn,
                  activeCamPreset === p.id && styles.presetBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.presetBtnText,
                    activeCamPreset === p.id && styles.presetBtnTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Assembly Animation Action Button */}
          <TouchableOpacity
            style={styles.assemblyBtn}
            onPress={startAssemblySequence}
            disabled={isAssembling}
          >
            <Play size={13} color="#17212E" fill="#17212E" />
            <Text style={styles.assemblyBtnText}>
              {isAssembling ? "Montage en cours..." : "Voir mon installation"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Floating Bottom HUD: Astronomical Sun & Shadow Simulator */}
        <View style={styles.bottomHud}>
          <View style={styles.sunControlsCard}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Sun size={15} color="#FFB800" />
                <Text style={styles.sunTitle}>Simulation Solaire & Ombres Portées</Text>
              </View>
              <Text style={styles.sunHourBadge}>
                {Math.floor(hourOfDay)}h{Math.round((hourOfDay % 1) * 60).toString().padStart(2, "0")} · Élev: {sunCoords.elevationDeg}°
              </Text>
            </View>

            {/* Hour of day slider */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={styles.sliderLabel}>06h</Text>
              <input
                type="range"
                min="6"
                max="20"
                step="0.25"
                value={hourOfDay}
                onChange={(e) => setHourOfDay(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: "#FFB800", cursor: "pointer" }}
              />
              <Text style={styles.sliderLabel}>20h</Text>
            </View>

            {/* Season Selector */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {(["summer", "equinox", "winter"] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSeason(s)}
                  style={[
                    styles.seasonBtn,
                    season === s && styles.seasonBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.seasonBtnText,
                      season === s && styles.seasonBtnTextActive,
                    ]}
                  >
                    {s === "summer" ? "Solstice d'Été" : s === "equinox" ? "Équinoxe" : "Solstice d'Hiver"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#FFE29A",
    backgroundColor: "#0B1422",
  },
  canvasWrapper: {
    width: "100%",
    height: 420,
    position: "relative",
  },
  mobilePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  topHud: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    pointerEvents: "box-none",
    zIndex: 10,
  },
  hudPill: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    backdropFilter: "blur(10px)" as any,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.3)",
    padding: 3,
    gap: 4,
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  presetBtnActive: {
    backgroundColor: "#FFB800",
  },
  presetBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#CBD5E1",
  },
  presetBtnTextActive: {
    color: "#17212E",
  },
  assemblyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFB800",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    shadowColor: "#FFB800",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 },
  },
  assemblyBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#17212E",
  },
  bottomHud: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    pointerEvents: "box-none",
    zIndex: 10,
  },
  sunControlsCard: {
    backgroundColor: "rgba(15, 23, 42, 0.90)",
    backdropFilter: "blur(12px)" as any,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.25)",
    padding: 12,
  },
  sunTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFDF7",
  },
  sunHourBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFB800",
  },
  sliderLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },
  seasonBtn: {
    flex: 1,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  seasonBtnActive: {
    backgroundColor: "rgba(255, 184, 0, 0.15)",
    borderColor: "#FFB800",
  },
  seasonBtnText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#94A3B8",
  },
  seasonBtnTextActive: {
    color: "#FFB800",
    fontWeight: "700",
  },
});
