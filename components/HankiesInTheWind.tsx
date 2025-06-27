import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface WaveSourceProps {
  position: [number, number, number];
  frequency: number;
  amplitude: number;
  phase: number;
}

interface HankiesInTheWindProps {
  overall: number; // 0-1 amplitude from audio
  initialZoom?: number;
}

const HankiesInTheWind: React.FC<HankiesInTheWindProps> = ({ overall, initialZoom = 6 }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let animationFrameId: number | null = null;
    let scene: any = null;
    let camera: any = null;
    let renderer: any = null;
    let lineGroups: any[] = [];
    let cameraZoom = initialZoom;

    // Create wave sources
    const createWaveSources = (time: number, scale: number, ampMod: number): WaveSourceProps[] => {
      const result: WaveSourceProps[] = [];
      const count = 5;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = scale * (1 + Math.sin(angle * 3) * 0.2);
        result.push({
          position: [
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius
          ],
          frequency: 2 + Math.sin(angle * 2),
          amplitude: (0.3 + Math.cos(angle) * 0.1) * ampMod,
          phase: time * 3 + angle
        });
      }
      result.push({
        position: [0, 0, 0],
        frequency: 3,
        amplitude: 0.4 * ampMod,
        phase: time * 4
      });
      return result;
    };

    // Create interference field geometry
    const createInterferenceField = (sources: WaveSourceProps[], size: number, resolution: number, time: number) => {
      const step = size / resolution;
      const heightMap: number[][] = [];
      for (let i = 0; i <= resolution; i++) {
        heightMap[i] = [];
        const x = (i * step) - (size / 2);
        for (let j = 0; j <= resolution; j++) {
          const z = (j * step) - (size / 2);
          let height = 0;
          sources.forEach(({ position: [sx, sy, sz], frequency, amplitude, phase }) => {
            const dx = x - sx;
            const dz = z - sz;
            const distance = Math.sqrt(dx * dx + dz * dz);
            height += Math.sin(distance * frequency - time * 5 + phase) * amplitude * Math.exp(-distance * 0.3);
          });
          heightMap[i][j] = height;
        }
      }
      const linesMaterial = new THREE.LineBasicMaterial({ 
        color: 0x333333,
        transparent: true,
        opacity: 0.4
      });
      const linesGroup = new THREE.Group();
      lineGroups.push(linesGroup);
      for (let i = 0; i <= resolution; i++) {
        const geometry = new THREE.BufferGeometry();
        const points = [];
        const x = (i * step) - (size / 2);
        for (let j = 0; j <= resolution; j++) {
          const z = (j * step) - (size / 2);
          points.push(x, heightMap[i][j], z);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        const line = new THREE.Line(geometry, linesMaterial);
        linesGroup.add(line);
      }
      for (let j = 0; j <= resolution; j++) {
        const geometry = new THREE.BufferGeometry();
        const points = [];
        const z = (j * step) - (size / 2);
        for (let i = 0; i <= resolution; i++) {
          const x = (i * step) - (size / 2);
          points.push(x, heightMap[i][j], z);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        const line = new THREE.Line(geometry, linesMaterial);
        linesGroup.add(line);
      }
      for (let i = 1; i < resolution; i++) {
        for (let j = 1; j < resolution; j++) {
          const x = (i * step) - (size / 2);
          const z = (j * step) - (size / 2);
          const height = heightMap[i][j];
          const heightDiff = Math.abs(
            height - 
            (heightMap[i-1][j] + heightMap[i+1][j] + 
             heightMap[i][j-1] + heightMap[i][j+1]) / 4
          );
          if (heightDiff > 0.2) {
            const geometry1 = new THREE.BufferGeometry();
            const points1 = [
              x - step/2, height, z - step/2,
              x + step/2, height, z + step/2
            ];
            geometry1.setAttribute('position', new THREE.Float32BufferAttribute(points1, 3));
            const line1 = new THREE.Line(geometry1, linesMaterial);
            linesGroup.add(line1);
            const geometry2 = new THREE.BufferGeometry();
            const points2 = [
              x - step/2, height, z + step/2,
              x + step/2, height, z - step/2
            ];
            geometry2.setAttribute('position', new THREE.Float32BufferAttribute(points2, 3));
            const line2 = new THREE.Line(geometry2, linesMaterial);
            linesGroup.add(line2);
          }
        }
      }
      return linesGroup;
    };

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(dpr, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0xF0EEE6);
    container.appendChild(renderer.domElement);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 5, 5);
    const pointLight = new THREE.PointLight(0xffffff, 0.4);
    pointLight.position.set(-5, 3, -5);
    scene.add(ambientLight);
    scene.add(directionalLight);
    scene.add(pointLight);
    camera.position.set(0, 0, cameraZoom);
    camera.lookAt(0, 0, 0);
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);
    let time = 0;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      time += 0.0013;
      // React to audio: modulate amplitude and camera zoom
      const ampMod = 1 + overall * 1.5;
      camera.position.set(0, 0, initialZoom - overall * 2.5);
      camera.lookAt(0, 0, 0);
      mainGroup.children.forEach((child: any) => {
        if (child instanceof THREE.Group) {
          child.children.forEach((line: any) => {
            if (line.geometry) line.geometry.dispose();
            if (line.material) line.material.dispose();
          });
          mainGroup.remove(child);
        }
      });
      lineGroups = [];
      const sources1 = createWaveSources(time, 1.5, ampMod);
      const field1 = createInterferenceField(sources1, 1.5 * 4, 32, time);
      mainGroup.add(field1);
      const sources2 = createWaveSources(time + 0.33, 0.8, ampMod);
      const field2 = createInterferenceField(sources2, 0.8 * 4, 32, time + 0.33);
      field2.position.set(0, 1.5, 0);
      field2.rotation.set(Math.PI/6, 0, Math.PI/4);
      mainGroup.add(field2);
      const sources3 = createWaveSources(time + 0.66, 0.8, ampMod);
      const field3 = createInterferenceField(sources3, 0.8 * 4, 32, time + 0.66);
      field3.position.set(0, -1.5, 0);
      field3.rotation.set(-Math.PI/6, 0, -Math.PI/4);
      mainGroup.add(field3);
      mainGroup.rotation.y = Math.sin(time * 0.3) * 0.2;
      mainGroup.rotation.x = Math.cos(time * 0.2) * 0.1;
      renderer.render(scene, camera);
    };
    animate();
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(dpr, 2));
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (renderer) {
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      }
      if (scene) {
        scene.traverse((object: any) => {
          if (object instanceof THREE.Mesh) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach((material: any) => material.dispose());
              } else {
                object.material.dispose();
              }
            }
          } else if (object instanceof THREE.Line) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) object.material.dispose();
          }
        });
      }
    };
  }, [overall, initialZoom]);

  return (
    <div 
      ref={containerRef}
      style={{ 
        margin: 0,
        background: '#F0EEE6',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        position: 'relative'
      }}
    />
  );
};

export default HankiesInTheWind; 