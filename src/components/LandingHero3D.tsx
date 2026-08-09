import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Cloud, Text } from '@react-three/drei';
import * as THREE from 'three';

// --- Error Boundary for WebGL Fallback ---
class WebGLErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.warn('WebGL Rendering Error in LandingHero3D:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// --- SUB-STEP 9: Cinematic Dolly-Zoom & Interactive Parallax Camera Controller ---
function CameraParallaxController({ reducedMotion }: { reducedMotion: boolean }) {
  useFrame(({ camera, pointer, clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();

    // 1. Slow cinematic dolly-zoom loop (mimicking camera movement in reference video)
    const dollyZ = 7.7 + Math.sin(t * 0.25) * 0.65;

    // 2. Slow orbital panning X and Y
    const orbitX = Math.sin(t * 0.15) * 0.6;
    const orbitY = Math.cos(t * 0.2) * 0.35;

    // 3. Interactive Mouse Parallax (cursor movement offsets camera slightly)
    const mouseX = pointer.x * 0.7;
    const mouseY = pointer.y * 0.35;

    // Target position calculation
    const targetX = 0.8 + orbitX + mouseX;
    const targetY = 0.6 + orbitY + mouseY;
    const targetZ = dollyZ;

    // Smooth Lerp Camera Position (60fps ultra-smooth gimbal dampening)
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.05);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.05);

    // Look at point focused slightly towards central foreground cyclist area
    camera.lookAt(0.3, -0.2, 0);
  });

  return null;
}

// --- SUB-STEP 3: Floating 3D Volumetric Clouds ---
function FloatingClouds({ reducedMotion }: { reducedMotion: boolean }) {
  const cloudGroupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    if (cloudGroupRef.current) {
      const t = clock.getElapsedTime();
      cloudGroupRef.current.position.x = Math.sin(t * 0.04) * 1.5;
      cloudGroupRef.current.position.y = Math.sin(t * 0.3) * 0.25;
      cloudGroupRef.current.rotation.y = Math.sin(t * 0.05) * 0.1;
    }
  });

  return (
    <group ref={cloudGroupRef}>
      <Cloud
        position={[-6, 3.5, -4]}
        speed={0.2}
        opacity={0.4}
        color="#38bdf8"
        segments={14}
      />
      <Cloud
        position={[6.2, 3.2, -4.5]}
        speed={0.25}
        opacity={0.35}
        color="#c084fc"
        segments={16}
      />
      <Cloud
        position={[0, 4.8, -5]}
        speed={0.15}
        opacity={0.45}
        color="#60a5fa"
        segments={18}
      />
    </group>
  );
}

// --- SUB-STEP 3: Floating 3D Lab Equipment (Tilted for True 3D Volume) ---
interface LabObjectProps {
  position: [number, number, number];
  liquidColor: string;
  phaseOffset: number;
  scale?: number;
  type?: 'test-tube' | 'flask';
  reducedMotion?: boolean;
}

function FloatingLabObject({
  position,
  liquidColor,
  phaseOffset,
  scale = 1,
  type = 'test-tube',
  reducedMotion = false,
}: LabObjectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const liquidMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      // Gentle floating up-down
      groupRef.current.position.y = position[1] + Math.sin(t * 1.6 + phaseOffset) * 0.22;
      // 3D Multi-Axis Rotation so top rim, sides, and bottom volume are fully visible in 3D!
      groupRef.current.rotation.x = 0.45 + Math.sin(t * 0.8 + phaseOffset) * 0.25;
      groupRef.current.rotation.y = t * 0.4 + phaseOffset;
      groupRef.current.rotation.z = 0.35 + Math.cos(t * 0.7 + phaseOffset) * 0.2;
    }
    if (liquidMatRef.current) {
      liquidMatRef.current.emissiveIntensity = 1.4 + 0.8 * (Math.sin(t * 3.14 + phaseOffset) * 0.5 + 0.5);
    }
    if (lightRef.current) {
      lightRef.current.intensity = 2.2 + 1.0 * (Math.sin(t * 3.14 + phaseOffset) * 0.5 + 0.5);
    }
  });

  return (
    <group ref={groupRef} position={position} scale={[scale, scale, scale]}>
      {/* Internal Point Light for Pure Neon Glow Effect */}
      <pointLight ref={lightRef} color={liquidColor} intensity={2.5} distance={4} />

      {type === 'test-tube' && (
        <>
          {/* Glass Tube Outer Cylinder (Ultra Crystal Transparent Glass) */}
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 1.25, 32]} />
            <meshStandardMaterial
              color="#ffffff"
              transparent={true}
              opacity={0.32}
              roughness={0.05}
              metalness={0.1}
            />
          </mesh>

          {/* Round Glass Bottom Cap */}
          <mesh position={[0, -0.625, 0]}>
            <sphereGeometry args={[0.19, 32, 32]} />
            <meshStandardMaterial
              color="#ffffff"
              transparent={true}
              opacity={0.32}
              roughness={0.05}
              metalness={0.1}
            />
          </mesh>

          {/* Glowing Inner Transparent Liquid Cylinder */}
          <mesh position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.155, 0.155, 0.75, 32]} />
            <meshStandardMaterial
              ref={liquidMatRef}
              color={liquidColor}
              emissive={liquidColor}
              emissiveIntensity={1.8}
              transparent={true}
              opacity={0.78}
              roughness={0.1}
              metalness={0.2}
            />
          </mesh>

          {/* Glowing Liquid Top Surface Disk */}
          <mesh position={[0, 0.175, 0]}>
            <cylinderGeometry args={[0.155, 0.155, 0.02, 32]} />
            <meshStandardMaterial
              color={liquidColor}
              emissive={liquidColor}
              emissiveIntensity={2.2}
              transparent={true}
              opacity={0.9}
            />
          </mesh>

          {/* Top Opening Glass Rim Torus */}
          <mesh position={[0, 0.625, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.19, 0.03, 16, 32]} />
            <meshStandardMaterial
              color={liquidColor}
              emissive={liquidColor}
              emissiveIntensity={1.2}
              roughness={0.1}
              transparent={true}
              opacity={0.8}
            />
          </mesh>
        </>
      )}

      {type === 'flask' && (
        <>
          {/* Flask Outer Conical Glass Body */}
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.18, 0.52, 0.85, 32]} />
            <meshStandardMaterial
              color="#ffffff"
              transparent={true}
              opacity={0.35}
              roughness={0.05}
              metalness={0.2}
            />
          </mesh>

          {/* Flask Cylindrical Glass Neck */}
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.35, 32]} />
            <meshStandardMaterial
              color="#ffffff"
              transparent={true}
              opacity={0.35}
              roughness={0.05}
              metalness={0.2}
            />
          </mesh>

          {/* Glowing Inner Liquid Volume */}
          <mesh position={[0, -0.25, 0]}>
            <cylinderGeometry args={[0.16, 0.46, 0.55, 32]} />
            <meshStandardMaterial
              ref={liquidMatRef}
              color={liquidColor}
              emissive={liquidColor}
              emissiveIntensity={1.8}
              transparent={true}
              opacity={0.78}
              roughness={0.1}
            />
          </mesh>

          {/* Liquid Level Surface Disk */}
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.02, 32]} />
            <meshStandardMaterial
              color={liquidColor}
              emissive={liquidColor}
              emissiveIntensity={2.2}
              transparent={true}
              opacity={0.9}
            />
          </mesh>

          {/* Flask Top Glass Rim */}
          <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.19, 0.03, 16, 32]} />
            <meshStandardMaterial
              color={liquidColor}
              emissive={liquidColor}
              emissiveIntensity={1.2}
              transparent={true}
              opacity={0.8}
            />
          </mesh>
        </>
      )}
    </group>
  );
}

// --- SUB-STEP 4: Floating 3D Formulas with Perspective Tilt ---
function FloatingFormulas({ reducedMotion }: { reducedMotion: boolean }) {
  const mainFormulaGroup = useRef<THREE.Group>(null);
  const mainFormulaTextRef = useRef<any>(null);

  const formula1Ref = useRef<THREE.Group>(null);
  const formula2Ref = useRef<THREE.Group>(null);
  const formula3LeftRef = useRef<THREE.Group>(null);
  const formula3RightRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();

    if (mainFormulaGroup.current) {
      mainFormulaGroup.current.position.y = 3.0 + Math.sin(t * 1.5) * 0.15;
      // 3D Perspective Tilt on E = mc²
      mainFormulaGroup.current.rotation.x = 0.06 + Math.sin(t * 0.7) * 0.04;
      mainFormulaGroup.current.rotation.y = -0.08 + Math.cos(t * 0.8) * 0.06;
      mainFormulaGroup.current.rotation.z = Math.sin(t * 0.6) * 0.03;
    }
    if (mainFormulaTextRef.current && mainFormulaTextRef.current.material) {
      const pulse = 0.8 + 0.2 * (Math.sin(t * 2.1) * 0.5 + 0.5);
      mainFormulaTextRef.current.material.opacity = pulse;
    }

    if (formula1Ref.current) {
      formula1Ref.current.position.y = 0.8 + Math.sin(t * 1.2 + 1.2) * 0.12;
      formula1Ref.current.rotation.y = 0.2 + Math.sin(t * 0.6) * 0.08;
    }
    if (formula2Ref.current) {
      formula2Ref.current.position.y = 0.8 + Math.sin(t * 1.1 + 2.5) * 0.12;
      formula2Ref.current.rotation.y = -0.2 + Math.cos(t * 0.6) * 0.08;
    }
    if (formula3LeftRef.current) {
      formula3LeftRef.current.position.y = -0.6 + Math.sin(t * 1.3 + 3.8) * 0.1;
    }
    if (formula3RightRef.current) {
      formula3RightRef.current.position.y = -0.6 + Math.sin(t * 1.4 + 1.5) * 0.1;
    }
  });

  return (
    <group>
      {/* Central Hero Formula: E = mc² (Clean glowing 3D text positioned high above mountain peak) */}
      <group ref={mainFormulaGroup} position={[0, 3.0, -4.0]}>
        <Text
          ref={mainFormulaTextRef}
          fontSize={1.15}
          color="#38bdf8"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#1d4ed8"
          fillOpacity={0.95}
        >
          E = mc²
        </Text>

        {/* 3D Extrusive Layer Shadow for Depth perception */}
        <group position={[0.04, -0.04, -0.08]}>
          <Text
            fontSize={1.15}
            color="#1e3a8a"
            anchorX="center"
            anchorY="middle"
            fillOpacity={0.65}
          >
            E = mc²
          </Text>
        </group>
      </group>

      {/* Secondary Formula 1: F = ma (Left of mountain, purple/pink glow) */}
      <group ref={formula1Ref} position={[-3.6, 0.8, -2.8]}>
        <Text
          fontSize={0.52}
          color="#c084fc"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#6b21a8"
          fillOpacity={0.9}
        >
          F = ma
        </Text>
      </group>

      {/* Secondary Formula 2: PV = nRT (Right of mountain, cyan glow) */}
      <group ref={formula2Ref} position={[3.6, 0.8, -2.8]}>
        <Text
          fontSize={0.52}
          color="#38bdf8"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#0369a1"
          fillOpacity={0.9}
        >
          PV = nRT
        </Text>
      </group>

      {/* Secondary Formula 3 Left: λ = h/p (Far Left, pink glow) */}
      <group ref={formula3LeftRef} position={[-4.5, -0.6, -2.0]}>
        <Text
          fontSize={0.44}
          color="#f43f5e"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#9f1239"
          fillOpacity={0.88}
        >
          λ = h / p
        </Text>
      </group>

      {/* Secondary Formula 3 Right: λ = h/p (Far Right, pink glow matching reference) */}
      <group ref={formula3RightRef} position={[4.5, -0.6, -2.0]}>
        <Text
          fontSize={0.44}
          color="#f43f5e"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#9f1239"
          fillOpacity={0.88}
        >
          λ = h / p
        </Text>
      </group>
    </group>
  );
}

// --- SUB-STEP 5: Foreground 3D Cyclist Character (Angled Perspective) ---
function StylizedCyclist({ reducedMotion }: { reducedMotion: boolean }) {
  const cyclistGroupRef = useRef<THREE.Group>(null);
  const frontWheelRef = useRef<THREE.Group>(null);
  const rearWheelRef = useRef<THREE.Group>(null);
  const formulaTextRef = useRef<any>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();

    if (cyclistGroupRef.current) {
      // Continuous left-to-right riding animation across foreground
      const travelSpeed = 1.5;
      const range = 16;
      const currentX = -8 + ((t * travelSpeed) % range);

      cyclistGroupRef.current.position.x = currentX;
      cyclistGroupRef.current.position.y = -1.95 + Math.sin(t * 6.0) * 0.035; // Pedaling bobbing
      cyclistGroupRef.current.rotation.z = Math.sin(t * 3.0) * 0.02;
    }

    // Wheel spin speed matched to forward velocity
    const spinSpeed = t * 6.0;
    if (frontWheelRef.current) {
      frontWheelRef.current.rotation.z = -spinSpeed;
    }
    if (rearWheelRef.current) {
      rearWheelRef.current.rotation.z = -spinSpeed;
    }

    if (formulaTextRef.current && formulaTextRef.current.material) {
      const pulse = 0.8 + 0.2 * (Math.sin(t * 3.0) * 0.5 + 0.5);
      formulaTextRef.current.material.opacity = pulse;
    }
  });

  return (
    // Angled 3D Isometric View: facing right along travel path
    <group
      ref={cyclistGroupRef}
      position={[-8, -1.95, 1.2]}
      rotation={[0.12, 0.18, 0.05]}
      scale={[0.85, 0.85, 0.85]}
    >
      {/* Bike 3D Frame */}
      {/* Main Bar */}
      <mesh position={[-0.2, 0.45, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.035, 0.035, 0.9, 12]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Down Bar */}
      <mesh position={[0.2, 0.4, 0]} rotation={[0, 0, 0.8]}>
        <cylinderGeometry args={[0.035, 0.035, 0.8, 12]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Seat Post & 3D Cushion Seat */}
      <mesh position={[-0.35, 0.6, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} />
      </mesh>
      <mesh position={[-0.37, 0.8, 0]}>
        <boxGeometry args={[0.26, 0.06, 0.16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} />
      </mesh>

      {/* 3D Handlebars */}
      <mesh position={[0.45, 0.75, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} />
      </mesh>
      <mesh position={[0.45, 0.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.42, 12]} />
        <meshStandardMaterial color="#06b6d4" metalness={0.9} />
      </mesh>

      {/* Rear Wheel (3D Torus Rim + 3D Spokes) */}
      <group position={[-0.7, 0.15, 0]}>
        <group ref={rearWheelRef}>
          <mesh>
            <torusGeometry args={[0.5, 0.04, 16, 32]} />
            <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.6} metalness={0.8} />
          </mesh>
          <mesh rotation={[0, 0, 0]}>
            <boxGeometry args={[0.95, 0.02, 0.02]} />
            <meshStandardMaterial color="#60a5fa" metalness={0.9} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.95, 0.02, 0.02]} />
            <meshStandardMaterial color="#60a5fa" metalness={0.9} />
          </mesh>
        </group>
      </group>

      {/* Front Wheel (3D Torus Rim + 3D Spokes) */}
      <group position={[0.7, 0.15, 0]}>
        <group ref={frontWheelRef}>
          <mesh>
            <torusGeometry args={[0.5, 0.04, 16, 32]} />
            <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.6} metalness={0.8} />
          </mesh>
          <mesh rotation={[0, 0, 0]}>
            <boxGeometry args={[0.95, 0.02, 0.02]} />
            <meshStandardMaterial color="#60a5fa" metalness={0.9} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.95, 0.02, 0.02]} />
            <meshStandardMaterial color="#60a5fa" metalness={0.9} />
          </mesh>
        </group>

        {/* Counter-Rotating 3D Text on Wheel Hub: v = d / t */}
        <group position={[0, 0, 0.12]}>
          <Text
            ref={formulaTextRef}
            fontSize={0.26}
            color="#c084fc"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.015}
            outlineColor="#581c87"
          >
            v = d / t
          </Text>
        </group>
      </group>

      {/* Stylized 3D Rider Figure */}
      <group position={[-0.1, 0.95, 0]} rotation={[0.1, 0, -0.38]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.34, 0.55, 0.26]} />
          <meshStandardMaterial color="#1e1b4b" roughness={0.4} metalness={0.3} />
        </mesh>

        {/* Head + Helmet */}
        <group position={[0, 0.42, 0]}>
          <mesh>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial color="#fed7aa" roughness={0.5} />
          </mesh>
          {/* Helmet Cap */}
          <mesh position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#06b6d4" emissive="#0891b2" emissiveIntensity={0.7} metalness={0.8} />
          </mesh>
        </group>

        {/* Arms to Handlebars */}
        <mesh position={[0.22, 0.1, 0.12]} rotation={[0, 0, -0.42]}>
          <cylinderGeometry args={[0.04, 0.04, 0.45, 12]} />
          <meshStandardMaterial color="#312e81" />
        </mesh>
        <mesh position={[0.22, 0.1, -0.12]} rotation={[0, 0, -0.42]}>
          <cylinderGeometry args={[0.04, 0.04, 0.45, 12]} />
          <meshStandardMaterial color="#312e81" />
        </mesh>
      </group>
    </group>
  );
}

// --- SUB-STEP 6: Procedural 3D DNA Double-Helix Component (Inclined 3D Angle) ---
function DNADoubleHelix({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  const { strand1Nodes, strand2Nodes, rungs } = useMemo(() => {
    const s1: [number, number, number][] = [];
    const s2: [number, number, number][] = [];
    const r: { start: [number, number, number]; end: [number, number, number]; y: number }[] = [];

    const numTurns = 3.2;
    const height = 4.5;
    const radius = 0.5;
    const pointsPerTurn = 18;
    const totalPoints = Math.floor(numTurns * pointsPerTurn);

    for (let i = 0; i <= totalPoints; i++) {
      const progress = i / totalPoints;
      const angle = progress * numTurns * Math.PI * 2;
      const y = (progress - 0.5) * height;

      const x1 = Math.cos(angle) * radius;
      const z1 = Math.sin(angle) * radius;

      const x2 = Math.cos(angle + Math.PI) * radius;
      const z2 = Math.sin(angle + Math.PI) * radius;

      s1.push([x1, y, z1]);
      s2.push([x2, y, z2]);

      if (i % 2 === 0) {
        r.push({ start: [x1, y, z1], end: [x2, y, z2], y });
      }
    }

    return { strand1Nodes: s1, strand2Nodes: s2, rungs: r };
  }, []);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.45;
      groupRef.current.position.y = -0.5 + Math.sin(t * 1.2) * 0.1;
    }
  });

  return (
    // Inclined 3D Tilt rotation={[0.4, 0.2, 0.35]} shows full 3D spatial depth of helix!
    <group ref={groupRef} position={[-4.5, -0.5, -0.8]} rotation={[0.4, 0.2, 0.35]} scale={[0.9, 0.9, 0.9]}>
      {strand1Nodes.map((pos, idx) => (
        <mesh key={`s1-${idx}`} position={pos}>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshStandardMaterial color="#06b6d4" emissive="#0891b2" emissiveIntensity={0.85} roughness={0.1} />
        </mesh>
      ))}

      {strand2Nodes.map((pos, idx) => (
        <mesh key={`s2-${idx}`} position={pos}>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshStandardMaterial color="#a855f7" emissive="#7e22ce" emissiveIntensity={0.85} roughness={0.1} />
        </mesh>
      ))}

      {rungs.map((rung, idx) => {
        const midX = (rung.start[0] + rung.end[0]) / 2;
        const midZ = (rung.start[2] + rung.end[2]) / 2;
        const dx = rung.end[0] - rung.start[0];
        const dz = rung.end[2] - rung.start[2];
        const length = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dz, dx);
        const color = idx % 2 === 0 ? '#34d399' : '#f43f5e';

        return (
          <mesh
            key={`rung-${idx}`}
            position={[midX, rung.y, midZ]}
            rotation={[0, -angle, 0]}
          >
            <cylinderGeometry args={[0.025, 0.025, length, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.75} roughness={0.2} />
          </mesh>
        );
      })}
    </group>
  );
}

// --- SUB-STEP 6: Anatomically Detailed Holographic Human Skeleton Model ---
function StylizedSkeleton({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const [activeBone, setActiveBone] = useState<{ name: string; pos: [number, number, number] } | null>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      // Subtle floating and gentle standing rotation
      groupRef.current.rotation.y = -0.1 + Math.sin(t * 0.8) * 0.06;
      groupRef.current.position.y = -0.4 + Math.sin(t * 1.2) * 0.08;
    }
  });

  const cyanMatProps = {
    color: "#22d3ee",
    emissive: "#0891b2",
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.5,
  };

  const cyanBrightMatProps = {
    color: "#38bdf8",
    emissive: "#0284c7",
    emissiveIntensity: 0.95,
    roughness: 0.1,
  };

  const highlightMatProps = {
    color: "#f43f5e",
    emissive: "#e11d48",
    emissiveIntensity: 1.2,
    roughness: 0.1,
  };

  const handlePointerOver = (name: string, pos: [number, number, number]) => (e: any) => {
    e.stopPropagation();
    setActiveBone({ name, pos });
    window.dispatchEvent(new CustomEvent('skeleton-bone-hover'));
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setActiveBone(null);
    window.dispatchEvent(new CustomEvent('skeleton-bone-out'));
  };

  return (
    <group ref={groupRef} position={[4.6, -0.4, -0.5]} scale={[0.82, 0.82, 0.82]}>
      {/* Interactive Floating Hover Tag Label */}
      {activeBone && (
        <group position={activeBone.pos}>
          {/* Glowing Target Node Dot */}
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#f43f5e" />
          </mesh>
          {/* Connector Line */}
          <mesh position={[0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.4, 8]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          {/* Label Text */}
          <Text
            position={[0.42, 0, 0]}
            fontSize={0.28}
            color="#ffffff"
            anchorX="left"
            anchorY="middle"
            outlineWidth={0.025}
            outlineColor="#0284c7"
          >
            {activeBone.name}
          </Text>
        </group>
      )}

      {/* --- SKULL (CRANIUM & FACIAL BONES) --- */}
      <group
        position={[0, 2.3, 0]}
        onPointerOver={handlePointerOver('Cranium & Mandible (Skull & Jaw)', [0, 2.3, 0.1])}
        onPointerOut={handlePointerOut}
      >
        {/* Main Cranium Sphere */}
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial
            {...(activeBone?.name.includes('Cranium') ? highlightMatProps : cyanBrightMatProps)}
            wireframe={true}
          />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.20, 16, 16]} />
          <meshStandardMaterial {...cyanMatProps} transparent opacity={0.4} />
        </mesh>
        {/* Maxilla & Cheekbones */}
        <mesh position={[0, -0.08, 0.08]}>
          <boxGeometry args={[0.22, 0.12, 0.16]} />
          <meshStandardMaterial {...cyanMatProps} wireframe={true} />
        </mesh>
        {/* Jaw (Mandible) */}
        <mesh position={[0, -0.18, 0.05]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.18, 0.08, 0.16]} />
          <meshStandardMaterial
            {...(activeBone?.name.includes('Cranium') ? highlightMatProps : cyanBrightMatProps)}
          />
        </mesh>
        {/* Glowing Eye Socket Outline Indicators */}
        <mesh position={[-0.07, 0.02, 0.18]}>
          <ringGeometry args={[0.03, 0.055, 16]} />
          <meshBasicMaterial color="#67e8f9" />
        </mesh>
        <mesh position={[0.07, 0.02, 0.18]}>
          <ringGeometry args={[0.03, 0.055, 16]} />
          <meshBasicMaterial color="#67e8f9" />
        </mesh>
        {/* Cervical Spine Joint / Neck */}
        <mesh position={[0, -0.28, -0.02]}>
          <cylinderGeometry args={[0.035, 0.035, 0.16, 12]} />
          <meshStandardMaterial {...cyanMatProps} />
        </mesh>
      </group>

      {/* --- SPINAL COLUMN (VERTEBRAE) --- */}
      <group
        position={[0, 1.35, -0.04]}
        onPointerOver={handlePointerOver('Vertebral Column (Spine)', [0, 1.35, 0])}
        onPointerOut={handlePointerOut}
      >
        {/* Vertebral Disks stack (10 segments along spine) */}
        {Array.from({ length: 10 }).map((_, i) => {
          const yPos = 0.55 - i * 0.11;
          const curveZ = Math.sin(i * 0.4) * 0.03;
          return (
            <group key={`vert-${i}`} position={[0, yPos, curveZ]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.045, 0.045, 0.05, 12]} />
                <meshStandardMaterial
                  {...(activeBone?.name.includes('Vertebral') ? highlightMatProps : cyanBrightMatProps)}
                />
              </mesh>
              {/* Transverse Processes (side spinal bumps) */}
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.015, 0.015, 0.14, 8]} />
                <meshStandardMaterial {...cyanMatProps} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* --- THORAX (STERNUM & RIBCAGE) --- */}
      <group
        position={[0, 1.4, 0]}
        onPointerOver={handlePointerOver('Ribcage & Sternum (Thoracic Cage)', [0, 1.4, 0.22])}
        onPointerOut={handlePointerOut}
      >
        {/* Sternum (Chestbone) */}
        <mesh position={[0, 0.05, 0.22]}>
          <boxGeometry args={[0.06, 0.65, 0.03]} />
          <meshStandardMaterial
            {...(activeBone?.name.includes('Ribcage') ? highlightMatProps : cyanBrightMatProps)}
          />
        </mesh>

        {/* 7 Curved Rib Pairs (Elliptical Tubes around spine to sternum) */}
        {[0.35, 0.24, 0.12, 0.0, -0.12, -0.24, -0.36].map((yPos, i) => {
          const widthScale = 0.42 - Math.abs(i - 2) * 0.035;
          return (
            <group key={`ribpair-${i}`} position={[0, yPos, 0.02]}>
              {/* Left & Right Rib Arch Torus Half */}
              <mesh rotation={[Math.PI / 2.3, 0, 0]}>
                <torusGeometry args={[widthScale, 0.022, 12, 28, Math.PI * 1.8]} />
                <meshStandardMaterial
                  {...(activeBone?.name.includes('Ribcage') ? highlightMatProps : cyanMatProps)}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* --- SHOULDER GIRDLE & ARMS --- */}
      <group position={[0, 1.85, 0]}>
        {/* Clavicles (Collarbones) */}
        <mesh
          position={[-0.22, 0, 0.08]}
          rotation={[0, 0, 0.15]}
          onPointerOver={handlePointerOver('Clavicle (Collarbone)', [-0.22, 1.85, 0.08])}
          onPointerOut={handlePointerOut}
        >
          <cylinderGeometry args={[0.025, 0.025, 0.42, 12]} />
          <meshStandardMaterial
            {...(activeBone?.name.includes('Clavicle') ? highlightMatProps : cyanBrightMatProps)}
          />
        </mesh>
        <mesh
          position={[0.22, 0, 0.08]}
          rotation={[0, 0, -0.15]}
          onPointerOver={handlePointerOver('Clavicle (Collarbone)', [0.22, 1.85, 0.08])}
          onPointerOut={handlePointerOut}
        >
          <cylinderGeometry args={[0.025, 0.025, 0.42, 12]} />
          <meshStandardMaterial
            {...(activeBone?.name.includes('Clavicle') ? highlightMatProps : cyanBrightMatProps)}
          />
        </mesh>

        {/* Left Arm Assembly */}
        <group position={[-0.45, -0.05, 0]}>
          {/* Shoulder Joint Ball */}
          <mesh>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial {...cyanBrightMatProps} />
          </mesh>
          {/* Humerus (Upper Arm) */}
          <mesh
            position={[-0.08, -0.4, 0]}
            rotation={[0, 0, 0.18]}
            onPointerOver={handlePointerOver('Humerus (Upper Arm Bone)', [-0.53, 1.4, 0])}
            onPointerOut={handlePointerOut}
          >
            <cylinderGeometry args={[0.032, 0.028, 0.75, 12]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Humerus') ? highlightMatProps : cyanMatProps)}
            />
          </mesh>
          {/* Elbow Joint */}
          <mesh position={[-0.15, -0.8, 0]}>
            <sphereGeometry args={[0.05, 14, 14]} />
            <meshStandardMaterial {...cyanBrightMatProps} />
          </mesh>
          {/* Forearm (Radius & Ulna) */}
          <mesh
            position={[-0.12, -1.2, 0.04]}
            rotation={[0.05, 0, -0.08]}
            onPointerOver={handlePointerOver('Radius & Ulna (Forearm Bones)', [-0.57, 0.65, 0])}
            onPointerOut={handlePointerOut}
          >
            <cylinderGeometry args={[0.022, 0.018, 0.7, 10]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Radius') ? highlightMatProps : cyanMatProps)}
            />
          </mesh>
          <mesh position={[-0.17, -1.2, -0.02]} rotation={[-0.05, 0, -0.08]}>
            <cylinderGeometry args={[0.02, 0.016, 0.7, 10]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Radius') ? highlightMatProps : cyanMatProps)}
            />
          </mesh>
          {/* Hand / Fingers Outline */}
          <mesh
            position={[-0.15, -1.6, 0.02]}
            onPointerOver={handlePointerOver('Phalanges (Hand & Fingers)', [-0.6, 0.25, 0])}
            onPointerOut={handlePointerOut}
          >
            <boxGeometry args={[0.08, 0.18, 0.03]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Phalanges') ? highlightMatProps : cyanBrightMatProps)}
              wireframe={true}
            />
          </mesh>
        </group>

        {/* Right Arm Assembly */}
        <group position={[0.45, -0.05, 0]}>
          {/* Shoulder Joint Ball */}
          <mesh>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial {...cyanBrightMatProps} />
          </mesh>
          {/* Humerus (Upper Arm) */}
          <mesh
            position={[0.08, -0.4, 0]}
            rotation={[0, 0, -0.18]}
            onPointerOver={handlePointerOver('Humerus (Upper Arm Bone)', [0.53, 1.4, 0])}
            onPointerOut={handlePointerOut}
          >
            <cylinderGeometry args={[0.032, 0.028, 0.75, 12]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Humerus') ? highlightMatProps : cyanMatProps)}
            />
          </mesh>
          {/* Elbow Joint */}
          <mesh position={[0.15, -0.8, 0]}>
            <sphereGeometry args={[0.05, 14, 14]} />
            <meshStandardMaterial {...cyanBrightMatProps} />
          </mesh>
          {/* Forearm (Radius & Ulna) */}
          <mesh
            position={[0.12, -1.2, 0.04]}
            rotation={[0.05, 0, 0.08]}
            onPointerOver={handlePointerOver('Radius & Ulna (Forearm Bones)', [0.57, 0.65, 0])}
            onPointerOut={handlePointerOut}
          >
            <cylinderGeometry args={[0.022, 0.018, 0.7, 10]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Radius') ? highlightMatProps : cyanMatProps)}
            />
          </mesh>
          <mesh position={[0.17, -1.2, -0.02]} rotation={[-0.05, 0, 0.08]}>
            <cylinderGeometry args={[0.02, 0.016, 0.7, 10]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Radius') ? highlightMatProps : cyanMatProps)}
            />
          </mesh>
          {/* Hand / Fingers Outline */}
          <mesh
            position={[0.15, -1.6, 0.02]}
            onPointerOver={handlePointerOver('Phalanges (Hand & Fingers)', [0.6, 0.25, 0])}
            onPointerOut={handlePointerOut}
          >
            <boxGeometry args={[0.08, 0.18, 0.03]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Phalanges') ? highlightMatProps : cyanBrightMatProps)}
              wireframe={true}
            />
          </mesh>
        </group>
      </group>

      {/* --- PELVIS (HIP GIRDLE) --- */}
      <group
        position={[0, 0.72, 0]}
        onPointerOver={handlePointerOver('Pelvic Girdle (Hip Bone)', [0, 0.72, 0.1])}
        onPointerOut={handlePointerOut}
      >
        {/* Iliac Crest Wings (Left & Right) */}
        <mesh position={[-0.18, 0.06, 0]} rotation={[0, 0.2, 0.3]}>
          <cylinderGeometry args={[0.16, 0.12, 0.18, 16]} />
          <meshStandardMaterial
            {...(activeBone?.name.includes('Pelvic') ? highlightMatProps : cyanBrightMatProps)}
            wireframe={true}
          />
        </mesh>
        <mesh position={[0.18, 0.06, 0]} rotation={[0, -0.2, -0.3]}>
          <cylinderGeometry args={[0.16, 0.12, 0.18, 16]} />
          <meshStandardMaterial
            {...(activeBone?.name.includes('Pelvic') ? highlightMatProps : cyanBrightMatProps)}
            wireframe={true}
          />
        </mesh>
        {/* Pubic Arch / Sacrum Center Base */}
        <mesh position={[0, -0.08, 0.02]}>
          <torusGeometry args={[0.14, 0.03, 12, 20]} />
          <meshStandardMaterial
            {...(activeBone?.name.includes('Pelvic') ? highlightMatProps : cyanMatProps)}
          />
        </mesh>
      </group>

      {/* --- LEGS & FEET --- */}
      <group position={[0, 0.6, 0]}>
        {/* Left Leg Assembly */}
        <group position={[-0.22, 0, 0]}>
          {/* Hip Joint Ball */}
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.065, 16, 16]} />
            <meshStandardMaterial {...cyanBrightMatProps} />
          </mesh>
          {/* Femur (Thigh Bone) angled down */}
          <mesh
            position={[-0.04, -0.5, 0]}
            rotation={[0, 0, 0.08]}
            onPointerOver={handlePointerOver('Femur (Thigh Bone)', [-0.26, 0.1, 0])}
            onPointerOut={handlePointerOut}
          >
            <cylinderGeometry args={[0.038, 0.032, 0.95, 12]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Femur') ? highlightMatProps : cyanMatProps)}
            />
          </mesh>
          {/* Knee Joint & Patella */}
          <mesh
            position={[-0.08, -1.0, 0.03]}
            onPointerOver={handlePointerOver('Patella (Knee Cap)', [-0.3, -0.4, 0.03])}
            onPointerOut={handlePointerOut}
          >
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Patella') ? highlightMatProps : cyanBrightMatProps)}
            />
          </mesh>
          {/* Lower Leg (Tibia & Fibula) */}
          <mesh
            position={[-0.07, -1.5, 0.02]}
            onPointerOver={handlePointerOver('Tibia & Fibula (Shin Bones)', [-0.29, -0.9, 0])}
            onPointerOut={handlePointerOut}
          >
            <cylinderGeometry args={[0.034, 0.026, 0.95, 12]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Tibia') ? highlightMatProps : cyanMatProps)}
            />
          </mesh>
          <mesh position={[-0.13, -1.5, -0.02]}>
            <cylinderGeometry args={[0.02, 0.016, 0.92, 10]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Tibia') ? highlightMatProps : cyanMatProps)}
            />
          </mesh>
          {/* Ankle Joint & Foot */}
          <mesh
            position={[-0.07, -2.0, 0.08]}
            rotation={[0.2, 0, 0]}
            onPointerOver={handlePointerOver('Tarsals & Metatarsals (Foot)', [-0.29, -1.4, 0.08])}
            onPointerOut={handlePointerOut}
          >
            <boxGeometry args={[0.1, 0.08, 0.24]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Tarsals') ? highlightMatProps : cyanBrightMatProps)}
              wireframe={true}
            />
          </mesh>
        </group>

        {/* Right Leg Assembly */}
        <group position={[0.22, 0, 0]}>
          {/* Hip Joint Ball */}
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.065, 16, 16]} />
            <meshStandardMaterial {...cyanBrightMatProps} />
          </mesh>
          {/* Femur (Thigh Bone) angled down */}
          <mesh
            position={[0.04, -0.5, 0]}
            rotation={[0, 0, -0.08]}
            onPointerOver={handlePointerOver('Femur (Thigh Bone)', [0.26, 0.1, 0])}
            onPointerOut={handlePointerOut}
          >
            <cylinderGeometry args={[0.038, 0.032, 0.95, 12]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Femur') ? highlightMatProps : cyanMatProps)}
            />
          </mesh>
          {/* Knee Joint & Patella */}
          <mesh
            position={[0.08, -1.0, 0.03]}
            onPointerOver={handlePointerOver('Patella (Knee Cap)', [0.3, -0.4, 0.03])}
            onPointerOut={handlePointerOut}
          >
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Patella') ? highlightMatProps : cyanBrightMatProps)}
            />
          </mesh>
          {/* Lower Leg (Tibia & Fibula) */}
          <mesh
            position={[0.07, -1.5, 0.02]}
            onPointerOver={handlePointerOver('Tibia & Fibula (Shin Bones)', [0.29, -0.9, 0])}
            onPointerOut={handlePointerOut}
          >
            <cylinderGeometry args={[0.034, 0.026, 0.95, 12]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Tibia') ? highlightMatProps : cyanMatProps)}
            />
          </mesh>
          <mesh position={[0.13, -1.5, -0.02]}>
            <cylinderGeometry args={[0.02, 0.016, 0.92, 10]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Tibia') ? highlightMatProps : cyanMatProps)}
            />
          </mesh>
          {/* Ankle Joint & Foot */}
          <mesh
            position={[0.07, -2.0, 0.08]}
            rotation={[0.2, 0, 0]}
            onPointerOver={handlePointerOver('Tarsals & Metatarsals (Foot)', [0.29, -1.4, 0.08])}
            onPointerOut={handlePointerOut}
          >
            <boxGeometry args={[0.1, 0.08, 0.24]} />
            <meshStandardMaterial
              {...(activeBone?.name.includes('Tarsals') ? highlightMatProps : cyanBrightMatProps)}
              wireframe={true}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// --- Stylized Low-Poly Mountain Component ---
function StylizedMountain() {
  const mainMountainGeo = useMemo(() => {
    const geo = new THREE.ConeGeometry(5.5, 7.5, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < 3.2 && y > -3.8) {
        const factor = (3.8 + y) * 0.16;
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const noise = (Math.sin(x * 2.5) + Math.cos(z * 2.5)) * 0.35 * factor;
        pos.setX(i, x + noise);
        pos.setZ(i, z + noise);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const peak1Geo = useMemo(() => {
    return new THREE.ConeGeometry(3.2, 4.8, 9);
  }, []);

  const peak2Geo = useMemo(() => {
    return new THREE.ConeGeometry(3.8, 5.2, 10);
  }, []);

  return (
    // Deep 3D Mountain Perspective Angle
    <group position={[0, -2.5, -4.5]} rotation={[0.1, 0.25, 0]}>
      {/* Central Main Mountain Peak */}
      <mesh geometry={mainMountainGeo} position={[0, 0, 0]}>
        <meshStandardMaterial
          color="#0f1738"
          roughness={0.5}
          metalness={0.4}
          flatShading={true}
        />
      </mesh>
      
      {/* Glowing Neon Outline Wireframe Overlay */}
      <mesh geometry={mainMountainGeo} position={[0, 0, 0]} scale={[1.003, 1.003, 1.003]}>
        <meshBasicMaterial
          color="#3b82f6"
          wireframe={true}
          transparent={true}
          opacity={0.3}
        />
      </mesh>

      {/* Left Peak */}
      <mesh geometry={peak1Geo} position={[-4, -0.8, -1.5]} rotation={[0, 0.4, 0]}>
        <meshStandardMaterial
          color="#0b122c"
          roughness={0.6}
          metalness={0.3}
          flatShading={true}
        />
      </mesh>

      {/* Right Peak */}
      <mesh geometry={peak2Geo} position={[3.8, -0.6, -1.8]} rotation={[0, -0.3, 0]}>
        <meshStandardMaterial
          color="#0d1433"
          roughness={0.6}
          metalness={0.3}
          flatShading={true}
        />
      </mesh>
    </group>
  );
}

// --- SUB-STEP 7: Glowing Circuit Board Ground Plane ---
function GlowingCircuitGround() {
  const gridTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Dark background matching deep space color
    ctx.fillStyle = '#060919';
    ctx.fillRect(0, 0, 1024, 1024);

    // Primary Grid Lines
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
    ctx.lineWidth = 2;
    const step = 64;

    for (let x = 0; x <= 1024; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Secondary Glowing Circuit Board Traces & Tech Nodes
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#38bdf8';

    for (let x = step; x < 1024; x += step * 2) {
      for (let y = step; y < 1024; y += step * 2) {
        // Circuit line path
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + step * 0.6, y);
        ctx.lineTo(x + step * 0.6, y + step * 0.6);
        ctx.stroke();

        // Node dots
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x + step * 0.6, y + step * 0.6, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    return tex;
  }, []);

  return (
    <group position={[0, -2.75, 0]}>
      {/* Circuit Grid Floor Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[45, 45]} />
        {gridTexture ? (
          <meshStandardMaterial
            map={gridTexture}
            transparent={true}
            opacity={0.8}
            emissive="#0284c7"
            emissiveIntensity={0.55}
            roughness={0.2}
            metalness={0.7}
          />
        ) : (
          <meshStandardMaterial color="#060919" />
        )}
      </mesh>

      {/* Horizon Fade Overlay for Smooth Distance Depth */}
      <mesh position={[0, 0.01, -12]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[45, 20]} />
        <meshBasicMaterial color="#060919" transparent={true} opacity={0.7} />
      </mesh>
    </group>
  );
}

// --- Animated Sci-Fi Rising Energy Bubbles / Particles ---
function RisingEnergyParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const count = 55;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 14,
      y: -4 + Math.random() * 9,
      z: (Math.random() - 0.5) * 6,
      speed: 0.012 + Math.random() * 0.02,
      factor: Math.random() * Math.PI * 2,
      scale: 0.035 + Math.random() * 0.075,
    }));
  }, [count]);

  useFrame(() => {
    if (!meshRef.current || reducedMotion) return;
    particles.forEach((p, i) => {
      p.y += p.speed;
      if (p.y > 5.5) {
        p.y = -4.5;
        p.x = (Math.random() - 0.5) * 14;
      }
      const wobbleX = p.x + Math.sin(p.y * 1.5 + p.factor) * 0.25;
      dummy.position.set(wobbleX, p.y, p.z);
      const pulseScale = p.scale * (0.85 + 0.3 * Math.sin(p.y * 2.5 + p.factor));
      dummy.scale.set(pulseScale, pulseScale, pulseScale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
    </instancedMesh>
  );
}

// --- Glowing Colorful Fast-Moving 3D Stars (Red, Green, Orange, Blue, Pink, Purple, Cyan) ---
function GlowingColorfulMovingStars({ reducedMotion }: { reducedMotion: boolean }) {
  const count = 450;
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const colorPalette = useMemo(() => [
    new THREE.Color("#ff2056"), // Glowing Red
    new THREE.Color("#10b981"), // Glowing Green
    new THREE.Color("#f97316"), // Glowing Orange
    new THREE.Color("#3b82f6"), // Glowing Blue
    new THREE.Color("#ec4899"), // Glowing Pink
    new THREE.Color("#06b6d4"), // Glowing Cyan
    new THREE.Color("#a855f7"), // Glowing Purple
    new THREE.Color("#facc15"), // Glowing Amber Yellow
  ], []);

  const starsData = useMemo(() => {
    return Array.from({ length: count }, () => {
      const radius = 5 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      // Perfectly balanced medium scale for clear, crisp glowing stars
      const scale = 0.018 + Math.random() * 0.032;
      const speed = 1.2 + Math.random() * 2.2;
      const phase = Math.random() * Math.PI * 2;

      return { x, y, z, color, scale, speed, phase, radius };
    });
  }, [count, colorPalette]);

  useEffect(() => {
    if (!meshRef.current) return;
    starsData.forEach((s, i) => {
      meshRef.current!.setColorAt(i, s.color);
    });
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [starsData]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current && !reducedMotion) {
      // Fast dynamic rotation of the starfield
      groupRef.current.rotation.y = t * 0.09;
      groupRef.current.rotation.x = Math.sin(t * 0.05) * 0.18;
    }

    if (meshRef.current && !reducedMotion) {
      starsData.forEach((s, i) => {
        // Fast twinkling scale pulse
        const pulse = Math.sin(t * s.speed * 3.5 + s.phase) * 0.4 + 1.0;
        const currentScale = s.scale * pulse;
        dummy.position.set(s.x, s.y, s.z);
        dummy.scale.set(currentScale, currentScale, currentScale);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.7, 8, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// --- Inner Scene Content with Enhanced 3D Lighting & Specular Rim Lights ---
function Hero3DScene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      {/* High Contrast 3D Key Lighting Setup */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[12, 15, 10]} intensity={3.2} color="#ffffff" />
      <directionalLight position={[-12, -8, -5]} intensity={1.2} color="#38bdf8" />
      <pointLight position={[-6, 5, -1]} intensity={1.8} color="#c084fc" distance={18} />
      <pointLight position={[6, 3, 3]} intensity={1.6} color="#38bdf8" distance={18} />

      {/* Glowing Colorful Fast-Moving 3D Stars */}
      <GlowingColorfulMovingStars reducedMotion={reducedMotion} />

      {/* Camera Ambient Parallax Controller */}
      <CameraParallaxController reducedMotion={reducedMotion} />
    </>
  );
}

// --- Background Image Fallback & Main Component ---
export function HeroMobileFallback() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 bg-[#060919]">
      <img
        src="/landing-bg.jpeg"
        alt="NEET Landing Background"
        className="w-full h-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#060919]/50 via-transparent to-[#060919]/80 pointer-events-none" />
    </div>
  );
}

export default function LandingHero3D() {
  const [isDesktop, setIsDesktop] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [activeCursor, setActiveCursor] = useState<string>('default');
  const [mouseParallax, setMouseParallax] = useState({ x: 0, y: 0 });
  const [hasVideoError, setHasVideoError] = useState<boolean>(false);

  // Listen for mouse movements for subtle 3D background depth parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * -16;
      const y = (e.clientY / window.innerHeight - 0.5) * -16;
      setMouseParallax({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Listen for bone hover events from scene and update cursor
  useEffect(() => {
    const onBoneHover = () => setActiveCursor('crosshair');
    const onBoneOut = () => setActiveCursor('default');
    window.addEventListener('skeleton-bone-hover', onBoneHover);
    window.addEventListener('skeleton-bone-out', onBoneOut);
    return () => {
      window.removeEventListener('skeleton-bone-hover', onBoneHover);
      window.removeEventListener('skeleton-bone-out', onBoneOut);
    };
  }, []);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleMotionChange);

    window.addEventListener('resize', checkDesktop);
    return () => {
      window.removeEventListener('resize', checkDesktop);
      mediaQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  // Mobile Chrome / Touch devices without desktop site mode -> render photo background
  if (!isDesktop) {
    return <HeroMobileFallback />;
  }

  return (
    <WebGLErrorBoundary fallback={<HeroMobileFallback />}>
      <div className="fixed inset-0 pointer-events-auto z-0 bg-[#060919]" style={{ cursor: activeCursor }}>
        {/* Parallax Fullscreen Background (Desktop MP4 Video with Photo Fallback) */}
        <div 
          className="absolute inset-0 transition-transform duration-300 ease-out z-0 pointer-events-none"
          style={{
            transform: `translate3d(${mouseParallax.x}px, ${mouseParallax.y}px, 0) scale(1.06)`
          }}
        >
          {hasVideoError ? (
            <img
              src="/landing-bg.jpeg"
              alt="NEET Landing Background"
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <video
              autoPlay
              loop
              muted
              playsInline
              onError={() => setHasVideoError(true)}
              className="w-full h-full object-cover object-center"
            >
              <source src="/landing-bg.mp4" type="video/mp4" />
              <source src="/landing-bg.webm" type="video/webm" />
              <img
                src="/landing-bg.jpeg"
                alt="NEET Landing Background"
                className="w-full h-full object-cover object-center"
              />
            </video>
          )}
        </div>

        {/* Subtle Vignette Overlay for Crisp Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#060919]/40 via-transparent to-[#060919]/70 pointer-events-none z-[1]" />

        {/* Floating Interactive 3D Canvas Layer */}
        <Canvas
          camera={{ position: [1.2, 0.8, 8.5], fov: 52 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 1.5]}
          eventSource={document.body}
          eventPrefix="client"
          style={{ position: 'relative', zIndex: 2 }}
        >
          <Suspense fallback={null}>
            <Hero3DScene reducedMotion={reducedMotion} />
          </Suspense>
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
