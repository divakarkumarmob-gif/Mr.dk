
import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Stars, Sphere, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function Earth({ meshRef }: { meshRef: React.RefObject<THREE.Mesh> }) {
  const textureMap = useLoader(THREE.TextureLoader, 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg');
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <Sphere ref={meshRef} args={[0.8, 64, 64]} position={[0, 0, 0]} rotation={[0, 1.36, 0]}>
      <meshStandardMaterial map={textureMap} />
    </Sphere>
  );
}

function Moon() {
  const groupRef = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const textureMap = useLoader(THREE.TextureLoader, 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg');
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5; // Orbit speed
    }
    if (mesh.current) {
      mesh.current.rotation.y += delta * 0.05;
    }
  });
  
  return (
    <group ref={groupRef}>
      <Sphere ref={mesh} args={[0.3, 32, 32]} position={[1.5, 0, 0]}>
        <meshStandardMaterial map={textureMap} />
      </Sphere>
    </group>
  );
}

export default function EarthGraphics() {
  const controlsRef = useRef<any>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performReset = () => {
    if (controlsRef.current) {
        controlsRef.current.reset();
    }
    if (meshRef.current) {
        meshRef.current.rotation.y = 1.36;
    }
  };

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
        performReset();
    }, 15000); // 15 seconds
  };

  useEffect(() => {
    resetTimer();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  return (
    <div className="w-full h-64 sm:h-96 rounded-xl overflow-hidden shadow-lg mb-6">
      <Canvas camera={{ position: [0, 0, 3] }}>
        <color attach="background" args={['#000000']} />
        <ambientLight intensity={0.1} />
        <directionalLight position={[-5, 5, 5]} intensity={1.5} />
        <Stars radius={100} depth={50} count={7000} factor={2} saturation={0} fade speed={1} />
        <OrbitControls 
            ref={controlsRef} 
            enablePan={true} 
            enableZoom={true} 
            enableRotate={true} 
            onStart={resetTimer}
            onChange={resetTimer}
        />
        <React.Suspense fallback={null}>
          <Earth meshRef={meshRef} />
          <Moon />
        </React.Suspense>
      </Canvas>
    </div>
  );
}
