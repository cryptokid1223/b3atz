"use client"

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three-stdlib";
import { useState } from 'react';

// Dynamically import Tone.js for SSR safety
let Tone: any = null;
if (typeof window !== "undefined") {
  Tone = window.Tone;
}

interface MusicVisualizerProps {
  audioSource: File | string; // Can be either a File or a URL string
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  isRecording: boolean;
  setAudioData: (data: { bass: number; mid: number; treble: number; overall: number }) => void;
  visualStyle: string;
  onTimeUpdate: (time: number) => void;
  onDuration: (duration: number) => void;
  onSeek: (time: number) => void;
  seekValue: number;
}

export default function MusicVisualizer({
  audioSource,
  isPlaying,
  setIsPlaying,
  isRecording,
  setAudioData,
  visualStyle,
  onTimeUpdate,
  onDuration,
  onSeek,
  seekValue,
}: MusicVisualizerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const velocitiesRef = useRef<Float32Array | null>(null);
  const userHasInteracted = useRef(false);
  const PARTICLE_COUNT = 12000;
  const SHAPES = ['sphere', 'nebula', 'matrix', 'lightning', 'vortex', 'crystal', 'fireworks', 'spiral'];
  const startTimeRef = useRef<number>(0); // When playback started
  const pausedAtRef = useRef<number>(0); // Where paused
  const lastSeekRef = useRef<number>(0); // Last seek position
  const rafTimeRef = useRef<number>(0); // For animation time
  const lastVisualStyleRef = useRef<string>(''); // Track visual style changes
  
  // Advanced beat detection and energy analysis
  const beatHistoryRef = useRef<number[]>([]);
  const energyHistoryRef = useRef<number[]>([]);
  const lastBeatTimeRef = useRef<number>(0);
  const beatThresholdRef = useRef<number>(0.6);
  const energyThresholdRef = useRef<number>(0.4);
  const particleVelocitiesRef = useRef<Float32Array | null>(null);
  const particleForcesRef = useRef<Float32Array | null>(null);
  const particleMassesRef = useRef<Float32Array | null>(null);

  // Video recording functionality
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Add at the top of the component:
  const bassHistoryRef = useRef<number[]>([]);
  const midHistoryRef = useRef<number[]>([]);
  const trebleHistoryRef = useRef<number[]>([]);
  const SMOOTHING_WINDOW = 6;

  const [dancerAmplitude, setDancerAmplitude] = useState(0);
  const [audioData, setAudioDataState] = useState({ bass: 0, mid: 0, treble: 0, overall: 0 });

  // Camera zoom constant
  const INITIAL_CAMERA_Z = 900; // Increase this value to zoom out further

  // Safari audio element ref
  const safariAudioRef = useRef<HTMLAudioElement | null>(null);

  // Mobile audio initialization
  const initializeMobileAudio = async () => {
    if (!audioContextRef.current) return;
    
    // For mobile devices, we need to resume the context
    if (audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
        console.log('Mobile audio context resumed successfully');
      } catch (error) {
        console.error('Failed to resume mobile audio context:', error);
      }
    }
  };

  // Check if we're on mobile Safari
  const isMobileSafari = typeof window !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) && 
    /Safari/.test(navigator.userAgent) && 
    !/Chrome/.test(navigator.userAgent)
  );

  // Check if we're on mobile
  const isMobile = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  );

  // Setup Three.js scene
  useEffect(() => {
    if (visualStyle === 'ascii') return; // Don't setup Three.js for ASCII
    if (!mountRef.current) return;
    if (rendererRef.current) {
      rendererRef.current.dispose();
      mountRef.current.innerHTML = "";
    }
    
    // Mobile detection
    const isMobileNow = window.innerWidth <= 768;
    
    const renderer = new THREE.WebGLRenderer({ 
      antialias: !isMobile, // Disable antialiasing on mobile for better performance
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setClearColor(0x000000, 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio on mobile
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = INITIAL_CAMERA_Z;
    cameraRef.current = camera;
    
    // OrbitControls with mobile optimizations
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.15;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.zoomSpeed = isMobile ? 0.05 : 0.1; // Slower zoom on mobile
    controls.minDistance = isMobile ? 100 : 60; // Further minimum distance on mobile
    controls.maxDistance = 2000;
    controls.autoRotate = false;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
    controls.addEventListener('start', () => { userHasInteracted.current = true; });
    
    // Particles with mobile optimizations
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const forces = new Float32Array(PARTICLE_COUNT * 3);
    const phases = new Float32Array(PARTICLE_COUNT);
    const freqBins = new Uint8Array(PARTICLE_COUNT);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const particleMasses = new Float32Array(PARTICLE_COUNT);
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      velocities[i * 3] = (Math.random() - 0.5) * 2;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 2;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;
      forces[i * 3] = 0;
      forces[i * 3 + 1] = 0;
      forces[i * 3 + 2] = 0;
      phases[i] = Math.random() * Math.PI * 2;
      freqBins[i] = Math.floor((i / PARTICLE_COUNT) * 128);
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 1.0;
      colors[i * 3 + 2] = 1.0;
      particleMasses[i] = 0.5 + Math.random() * 0.5; // Varying particle masses
    }
    
    velocitiesRef.current = velocities;
    particleVelocitiesRef.current = velocities;
    particleForcesRef.current = forces;
    particleMassesRef.current = particleMasses;
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("freqBin", new THREE.BufferAttribute(freqBins, 1));
    
    const material = new THREE.PointsMaterial({
      size: isMobile ? 1.8 : 2.2, // Smaller particles on mobile for better performance
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xffffff,
    });
    
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;
    
    // Resize handler with mobile optimizations
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobileNow = width <= 768;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobileNow ? 1.5 : 2));
      
      // Update material size for mobile
      if (material) {
        material.size = isMobileNow ? 1.8 : 2.2;
        material.needsUpdate = true;
      }
    };
    
    window.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      mountRef.current && (mountRef.current.innerHTML = "");
    };
  }, [visualStyle]);

  // Load audio file into buffer
  useEffect(() => {
    if (!audioSource) return;
    
    const loadAudio = async () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      
      // For mobile Safari, we'll use a different approach
      if (isMobileSafari) {
        console.log('Detected mobile Safari - using HTML5 audio fallback');
        // We'll handle Safari audio differently in the play/pause logic
        audioContextRef.current = null;
        return;
      }
      
      // Mobile audio context handling
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      
      // For mobile devices, we need to resume the context on user interaction
      if (audioContext.state === 'suspended') {
        console.log('Audio context suspended, waiting for user interaction...');
        // We'll resume it when the user tries to play
      }
      
      audioContextRef.current = audioContext;
      
      try {
        let arrayBuffer: ArrayBuffer;
        
        if (typeof audioSource === 'string') {
          // Handle URL string - fetch the audio file
          console.log('Loading audio from URL:', audioSource);
          const response = await fetch(audioSource);
          if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
          }
          arrayBuffer = await response.arrayBuffer();
        } else {
          // Handle File - use FileReader
          console.log('Loading audio file:', audioSource.name, 'Size:', audioSource.size);
          arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              if (e.target?.result instanceof ArrayBuffer) {
                console.log('File read successfully, size:', e.target.result.byteLength);
                resolve(e.target.result);
              } else {
                reject(new Error('Failed to read file'));
              }
            };
            reader.onerror = (e) => {
              console.error('FileReader error:', e);
              reject(new Error('File read error'));
            };
            reader.readAsArrayBuffer(audioSource);
          });
        }
        
        console.log('Decoding audio data...');
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBufferRef.current = audioBuffer;
        // Set duration when loaded
        onDuration(audioBuffer.duration);
        console.log('Audio loaded successfully, duration:', audioBuffer.duration, 'channels:', audioBuffer.numberOfChannels, 'sample rate:', audioBuffer.sampleRate);
      } catch (error) {
        console.error('Failed to load audio:', error);
        alert(`Failed to load audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    
    loadAudio();
    
    // Clean up
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (safariAudioRef.current) {
        safariAudioRef.current.pause();
        safariAudioRef.current.src = '';
        if (typeof audioSource === 'object' && audioSource instanceof File) {
          URL.revokeObjectURL(safariAudioRef.current.src);
        }
        safariAudioRef.current = null;
      }
    };
  }, [audioSource, onDuration, isMobileSafari]);

  // Animation loop
  useEffect(() => {
    let lastAmp = 0;
    let running = true;
    let t = 0;
    let cameraAngle = 0;
    let cameraShake = 0;
    
    // Check if visual style changed and force reset
    if (lastVisualStyleRef.current !== visualStyle) {
      lastVisualStyleRef.current = visualStyle;
      // Force reset particle positions when visual style changes
      if (particlesRef.current) {
        const positions = particlesRef.current.geometry.getAttribute("position");
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          positions.array[i * 3] = 0;
          positions.array[i * 3 + 1] = 0;
          positions.array[i * 3 + 2] = 0;
        }
        positions.needsUpdate = true;
      }
    }
    
    // Create controls properly
    let controls: OrbitControls | null = null;
    if (rendererRef.current && cameraRef.current) {
      controls = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.15;
      controls.enablePan = false;
      controls.enableZoom = true;
      controls.zoomSpeed = 0.1;
      controls.minDistance = 60;
      controls.maxDistance = 2000;
      controls.autoRotate = false;
      controls.addEventListener('start', () => { userHasInteracted.current = true; });
    }
    
    const animate = () => {
      // Advanced audio analysis with beat detection
      let freqData: Uint8Array = new Uint8Array(128);
      let beatInfo = { isBeat: false, beatStrength: 0, energy: 0 };
      let spectrumInfo = {
        bass: 0, mid: 0, treble: 0, overall: 0,
        bassPeak: 0, midPeak: 0, treblePeak: 0,
        harmonicContent: 0, rhythmComplexity: 0
      };
      
      if (analyserRef.current && isPlaying) {
        freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freqData);
        beatInfo = detectBeat(freqData, t * 0.016); // Convert frame count to time
        spectrumInfo = analyzeFrequencySpectrum(freqData);
        // Smooth bass, mid, treble
        function smoothBand(historyRef: React.MutableRefObject<number[]>, value: number) {
          historyRef.current.push(value);
          if (historyRef.current.length > SMOOTHING_WINDOW) historyRef.current.shift();
          return historyRef.current.reduce((a, b) => a + b, 0) / historyRef.current.length;
        }
        const bassNorm = Math.max(0, Math.min(1, smoothBand(bassHistoryRef, spectrumInfo.bass)));
        const midNorm = Math.max(0, Math.min(1, smoothBand(midHistoryRef, spectrumInfo.mid)));
        const trebleNorm = Math.max(0, Math.min(1, smoothBand(trebleHistoryRef, spectrumInfo.treble)));
        // Use these normalized values for both setAudioData and for visuals
        setAudioData({ bass: bassNorm, mid: midNorm, treble: trebleNorm, overall: Math.max(0, Math.min(1, spectrumInfo.overall)) });
        setAudioDataState({ bass: bassNorm, mid: midNorm, treble: trebleNorm, overall: Math.max(0, Math.min(1, spectrumInfo.overall)) });
        setDancerAmplitude(Math.max(0, Math.min(1, spectrumInfo.overall)));
      }
      
      // Camera orbit and shake (only if user hasn't interacted and music is playing)
      if (!userHasInteracted.current && isPlaying) {
        const cameraIntensity = beatInfo.beatStrength * 0.8 + spectrumInfo.overall * 0.5;
        const harmonicInfluence = spectrumInfo.harmonicContent * 0.3;
        const rhythmInfluence = spectrumInfo.rhythmComplexity * 0.2;
        
        cameraAngle += 0.002 + cameraIntensity * 0.03 + harmonicInfluence * 0.01;
        if (cameraRef.current) {
          const r = INITIAL_CAMERA_Z + Math.sin(t * 0.002) * 30 + cameraShake;
          cameraRef.current.position.x = Math.cos(cameraAngle) * r;
          cameraRef.current.position.z = Math.sin(cameraAngle) * r;
          cameraRef.current.position.y = Math.sin(cameraAngle * 0.7) * 60;
          cameraRef.current.lookAt(0, 0, 0);
          if (cameraShake > 0) cameraShake *= 0.92;
          
          // Enhanced beat-driven camera shake with frequency response
          if (beatInfo.isBeat) {
            const shakeIntensity = beatInfo.beatStrength * 60 + spectrumInfo.bass * 20;
            cameraShake = shakeIntensity;
            
            // Add frequency-based camera movement
            const bassInfluence = spectrumInfo.bass * 15;
            const trebleInfluence = spectrumInfo.treble * 10;
            cameraRef.current.position.x += Math.sin(t * 0.1) * bassInfluence;
            cameraRef.current.position.z += Math.cos(t * 0.1) * trebleInfluence;
          }
        }
      }
      
      // Update controls
      if (controls) controls.update();
      
      // Advanced particle physics system
      const particles = particlesRef.current;
      const velocities = velocitiesRef.current;
      const forces = particleForcesRef.current;
      const masses = particleMassesRef.current;
      
      if (particles && velocities && forces && masses) {
        const positions = particles.geometry.getAttribute("position");
        const phases = particles.geometry.getAttribute("phase");
        const freqBins = particles.geometry.getAttribute("freqBin");
        const colors = particles.geometry.getAttribute("color");
        
        // Clear forces
        for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
          forces[i] = 0;
        }
        
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const bin = freqBins.array[i];
          const binAmp = isPlaying ? (freqData[bin] / 255) : 0;
          const mass = masses[i];
          
          // Advanced target calculation based on visual style
          let target = [0, 0, 0];
          let targetForce = 1.0;
          
          if (visualStyle === 'sphere') {
            // Beat-synchronized sphere with harmonic resonance
            const phi = Math.acos(2 * (i / PARTICLE_COUNT) - 1);
            const theta = Math.PI * 2 * ((i * 1.618) % 1);
            const baseRadius = 120 + 120 * binAmp;
            const beatRadius = beatInfo.isBeat ? beatInfo.beatStrength * 100 : 0;
            const harmonicRadius = spectrumInfo.harmonicContent * 80;
            const r = baseRadius + beatRadius + harmonicRadius + 60 * Math.sin(t * 0.01 + i);
            
            target = [
              Math.sin(phi) * Math.cos(theta) * r,
              Math.cos(phi) * r,
              Math.sin(phi) * Math.sin(theta) * r,
            ];
            targetForce = 0.15 + 0.25 * binAmp + 0.1 * beatInfo.beatStrength;
            
          } else if (visualStyle === 'nebula') {
            // Cosmic nebula with stellar evolution and beat-driven expansion
            const layer = i % 4;
            const baseAngle = (i / PARTICLE_COUNT) * Math.PI * 8 + (isPlaying ? t * 0.003 : 0);
            const beatExpansion = beatInfo.isBeat ? beatInfo.beatStrength * 200 : 0;
            const harmonicSwirl = spectrumInfo.harmonicContent * 100;
            
            const radius = 60 + 300 * Math.sin(baseAngle * 0.6) + 150 * binAmp + 
                          layer * 50 + beatExpansion + harmonicSwirl;
            const height = Math.sin(baseAngle * 4) * 100 + Math.cos((isPlaying ? t * 0.02 : 0) + i * 0.1) * 80;
            const spiral = Math.sin(baseAngle * 5 + (isPlaying ? t * 0.01 : 0)) * 80;
            const turbulence = Math.sin(baseAngle * 7 + (isPlaying ? t * 0.015 : 0)) * 60;
            
            target = [
              Math.cos(baseAngle) * radius + spiral + turbulence,
              height + layer * 30,
              Math.sin(baseAngle) * radius + spiral + turbulence,
            ];
            targetForce = 0.12 + 0.18 * binAmp + 0.08 * beatInfo.beatStrength;
            
          } else if (visualStyle === 'matrix') {
            // Advanced Matrix with beat-synchronized data streams and hacking effects
            const streamCount = 20;
            const streamId = i % streamCount;
            const charPos = Math.floor(i / streamCount);
            const fallSpeed = 1.0 + 0.8 * binAmp + 0.5 * beatInfo.beatStrength;
            const fallOffset = isPlaying ? ((t * fallSpeed + charPos * 6 + streamId * 2) % 600) : (charPos * 6 + streamId * 2) % 600;
            const streamOffset = Math.sin((isPlaying ? t * 0.025 : 0) + streamId) * 25;
            const charWobble = Math.sin((isPlaying ? t * 0.06 : 0) + charPos * 0.4) * 12;
            const beatDistortion = beatInfo.isBeat ? beatInfo.beatStrength * 30 : 0;
            
            target = [
              (streamId - streamCount/2) * 30 + streamOffset + charWobble + beatDistortion,
              -fallOffset + 300,
              Math.sin((isPlaying ? t * 0.015 : 0) + streamId * 0.3) * 30,
            ];
            targetForce = 0.2 + 0.3 * binAmp + 0.15 * beatInfo.beatStrength;
            
          } else if (visualStyle === 'lightning') {
            // Realistic lightning with beat-driven branching and electric storms
            const boltCount = 10;
            const boltId = i % boltCount;
            const boltPos = Math.floor(i / boltCount);
            const boltAngle = (boltId / boltCount) * Math.PI * 2 + (isPlaying ? t * 0.025 : 0);
            const boltRadius = 30 + 220 * binAmp + beatInfo.beatStrength * 150;
            
            // Advanced branching with beat-driven complexity
            const branchLevel = Math.floor(boltPos / 40);
            const branchAngle = boltAngle + (branchLevel * 0.4) + Math.sin((isPlaying ? t * 0.06 : 0) + boltId) * 0.3;
            const branchRadius = boltRadius * (0.6 + 0.4 * branchLevel);
            
            // Multi-frequency zigzag for realistic lightning
            const zigzag1 = Math.sin(boltPos * 1.2 + (isPlaying ? t * 0.2 : 0)) * 35;
            const zigzag2 = Math.sin(boltPos * 0.4 + (isPlaying ? t * 0.1 : 0)) * 20;
            const zigzag3 = Math.sin(boltPos * 0.15 + (isPlaying ? t * 0.04 : 0)) * 12;
            const totalZigzag = zigzag1 + zigzag2 + zigzag3;
            
            const height = boltPos * 10 - 250;
            const electricArc = Math.sin((isPlaying ? t * 0.25 : 0) + boltPos * 0.15) * 15;
            const beatArc = beatInfo.isBeat ? beatInfo.beatStrength * 25 : 0;
            
            target = [
              Math.cos(branchAngle) * branchRadius + totalZigzag + electricArc + beatArc,
              height,
              Math.sin(branchAngle) * branchRadius + totalZigzag + electricArc + beatArc,
            ];
            targetForce = 0.25 + 0.35 * binAmp + 0.2 * beatInfo.beatStrength;
            
          } else if (visualStyle === 'vortex') {
            // Advanced vortex with beat-driven turbulence and energy waves
            const armCount = 8;
            const armId = i % armCount;
            const armPos = Math.floor(i / armCount);
            const baseAngle = (armId / armCount) * Math.PI * 2 + (isPlaying ? t * 0.02 : 0);
            const spiralTightness = 3.0 + 2.0 * binAmp + beatInfo.beatStrength * 1.5;
            const radius = 15 + 180 * (1 - armPos / (PARTICLE_COUNT / armCount)) + 100 * binAmp;
            const height = (armPos / (PARTICLE_COUNT / armCount)) * 700 - 350;
            
            // Complex spiral motion with multiple harmonics
            const spiral1 = Math.sin(baseAngle * 4 + (isPlaying ? t * 0.04 : 0)) * 40;
            const spiral2 = Math.cos(baseAngle * 3 + (isPlaying ? t * 0.03 : 0)) * 30;
            const spiral3 = Math.sin(baseAngle * 2.5 + (isPlaying ? t * 0.035 : 0)) * 20;
            const totalSpiral = spiral1 + spiral2 + spiral3;
            
            // Beat-driven turbulence and energy waves
            const turbulence = Math.sin((isPlaying ? t * 0.05 : 0) + armPos * 0.08) * 35;
            const wave = Math.cos((isPlaying ? t * 0.025 : 0) + baseAngle * 5) * 25;
            const beatWave = beatInfo.isBeat ? beatInfo.beatStrength * 40 : 0;
            
            target = [
              Math.cos(baseAngle) * radius + totalSpiral + turbulence + beatWave,
              height + wave,
              Math.sin(baseAngle) * radius + totalSpiral + turbulence + beatWave,
            ];
            targetForce = 0.18 + 0.22 * binAmp + 0.12 * beatInfo.beatStrength;
            
          } else if (visualStyle === 'crystal') {
            // Advanced crystal formations with beat-driven growth and harmonic resonance
            const crystalCount = 15;
            const crystalId = i % crystalCount;
            const crystalPos = Math.floor(i / crystalCount);
            const facetCount = 10;
            const facetId = crystalPos % facetCount;
            const facetAngle = (facetId / facetCount) * Math.PI * 2;
            const crystalAngle = (crystalId / crystalCount) * Math.PI * 2 + (isPlaying ? t * 0.015 : 0);
            
            // Complex crystal geometry with beat-driven expansion
            const baseRadius = 50 + 160 * Math.sin((isPlaying ? t * 0.01 : 0) + crystalPos * 0.04) + 100 * binAmp;
            const beatExpansion = beatInfo.isBeat ? beatInfo.beatStrength * 80 : 0;
            const facetRadius = (baseRadius + beatExpansion) * (0.7 + 0.3 * Math.sin(facetAngle * 4));
            const height = Math.sin(facetAngle * 5) * 80 + Math.cos((isPlaying ? t * 0.018 : 0) + crystalId * 0.25) * 60;
            
            // Crystal growth and harmonic effects
            const growth = Math.sin((isPlaying ? t * 0.008 : 0) + crystalPos * 0.08) * 30;
            const expansion = Math.cos((isPlaying ? t * 0.02 : 0) + crystalId) * 25;
            const harmonicGrowth = spectrumInfo.harmonicContent * 40;
            
            target = [
              Math.cos(crystalAngle) * Math.cos(facetAngle) * facetRadius + growth + harmonicGrowth,
              height + expansion,
              Math.sin(crystalAngle) * Math.cos(facetAngle) * facetRadius + growth + harmonicGrowth,
            ];
            targetForce = 0.16 + 0.24 * binAmp + 0.1 * beatInfo.beatStrength;
            
          } else if (visualStyle === 'fireworks') {
            // Advanced fireworks with beat-driven explosions and realistic particle physics
            const burstCount = 8;
            const burstId = i % burstCount;
            const burstPos = Math.floor(i / burstCount);
            const burstAngle = (burstId / burstCount) * Math.PI * 2;
            
            // Multiple firework types with beat synchronization
            const fireworkType = burstId % 4; // 0: sphere, 1: spiral, 2: starburst, 3: ring
            let burstRadius, burstHeight, explosion;
            
            if (fireworkType === 0) {
              // Spherical explosion with beat-driven intensity
              burstRadius = burstPos * 10 + 40 * binAmp + beatInfo.beatStrength * 60;
              burstHeight = Math.sin((isPlaying ? t * 0.03 : 0) + burstId) * 100;
              explosion = Math.sin((isPlaying ? t * 0.08 : 0)) * 60;
            } else if (fireworkType === 1) {
              // Spiral explosion with harmonic resonance
              const spiralAngle = burstAngle + burstPos * 0.6 + (isPlaying ? t * 0.025 : 0);
              burstRadius = burstPos * 8 + 35 * binAmp + spectrumInfo.harmonicContent * 50;
              burstHeight = Math.cos((isPlaying ? t * 0.035 : 0) + burstId) * 80;
              explosion = Math.sin(spiralAngle) * 40;
            } else if (fireworkType === 2) {
              // Starburst with beat-driven spikes
              const starburstAngle = burstAngle + burstPos * 0.4;
              burstRadius = burstPos * 12 + 45 * binAmp + beatInfo.beatStrength * 70;
              burstHeight = Math.sin((isPlaying ? t * 0.04 : 0) + burstId * 0.6) * 120;
              explosion = Math.cos(starburstAngle) * 70;
            } else {
              // Ring explosion with harmonic waves
              const ringAngle = burstAngle + burstPos * 0.3;
              burstRadius = burstPos * 6 + 30 * binAmp + spectrumInfo.harmonicContent * 40;
              burstHeight = Math.sin((isPlaying ? t * 0.045 : 0) + burstId * 0.4) * 90;
              explosion = Math.sin(ringAngle) * 50;
            }
            
            // Advanced particle physics with gravity and trails
            const trail = Math.sin((isPlaying ? t * 0.12 : 0) + burstPos * 0.15) * 20;
            const gravity = burstPos * 0.8; // Realistic gravity effect
            const beatTrail = beatInfo.isBeat ? beatInfo.beatStrength * 30 : 0;
            
            target = [
              Math.cos(burstAngle) * burstRadius + explosion + trail + beatTrail,
              burstHeight - gravity,
              Math.sin(burstAngle) * burstRadius + explosion + trail + beatTrail,
            ];
            targetForce = 0.22 + 0.28 * binAmp + 0.15 * beatInfo.beatStrength;
            
          } else if (visualStyle === 'spiral') {
            // Advanced spiral with beat-driven modulation and harmonic complexity
            const baseArms = 5;
            const ampArms = Math.round(3 + 6 * Math.max(0.1, Math.min(1, spectrumInfo.overall)));
            const arms = baseArms + ampArms;
            const spiralTightness = 1.0 + 1.5 * spectrumInfo.overall + 0.8 * Math.sin((isPlaying ? t * 0.015 : 0)) + beatInfo.beatStrength * 0.5;
            const tNorm = i / PARTICLE_COUNT;
            const arm = i % arms;
            const r = 50 + 250 * tNorm + 100 * binAmp + beatInfo.beatStrength * 80;
            let theta = arm * (2 * Math.PI / arms) + spiralTightness * Math.log(r) + phases.array[i];
            theta += Math.sin((isPlaying ? t * 0.015 : 0) + arm) * 0.3 * spectrumInfo.overall;
            
            // Beat-driven bursts and harmonic modulation
            if (beatInfo.isBeat && Math.random() < 0.2) {
              theta += Math.random() * Math.PI * 2 * beatInfo.beatStrength;
            }
            
            const z = (Math.random() - 0.5) * 25 * (1 - tNorm) + Math.sin(theta * 3 + (isPlaying ? t * 0.015 : 0)) * 12 * tNorm;
            target = [
              Math.cos(theta) * r,
              z,
              Math.sin(theta) * r,
            ];
            targetForce = 0.14 + 0.26 * binAmp + 0.12 * beatInfo.beatStrength;
          } else if (visualStyle === 'forest') {
            // Forest/Trees visual with swaying, growing, and seasonal changes
            const treeCount = 8;
            const treeId = i % treeCount;
            const treePos = Math.floor(i / treeCount);
            const treeAngle = (treeId / treeCount) * Math.PI * 2;
            const treeSpacing = 80;
            // Tree structure: trunk and branches
            const isTrunk = treePos < 20; // First 20 particles per tree = trunk
            const isBranch = treePos >= 20 && treePos < 60; // Next 40 particles = branches
            const isLeaf = treePos >= 60; // Remaining particles = leaves
            if (isTrunk) {
              // Tree trunk - vertical with slight sway
              const trunkHeight = 120 + 60 * binAmp + beatInfo.beatStrength * 40; // Growth with audio
              const swayAmount = spectrumInfo.overall * 15 * Math.sin((isPlaying ? t * 0.02 : 0) + treeId);
              target = [
                Math.cos(treeAngle) * treeSpacing + swayAmount,
                treePos * 6 - 100, // Trunk height
                Math.sin(treeAngle) * treeSpacing + swayAmount,
              ];
              targetForce = 0.2 + 0.3 * binAmp + 0.15 * beatInfo.beatStrength;
            } else if (isBranch) {
              // Tree branches - extending from trunk
              const branchLevel = Math.floor((treePos - 20) / 8); // 8 particles per branch level
              const branchAngle = treeAngle + (branchLevel * 0.4) + Math.sin((isPlaying ? t * 0.03 : 0) + treeId) * 0.2;
              const branchLength = 30 + 20 * binAmp + beatInfo.beatStrength * 15;
              const branchHeight = 60 + branchLevel * 20 + Math.sin((isPlaying ? t * 0.015 : 0) + treeId) * 10;
              target = [
                Math.cos(treeAngle) * treeSpacing + Math.cos(branchAngle) * branchLength,
                branchHeight,
                Math.sin(treeAngle) * treeSpacing + Math.sin(branchAngle) * branchLength,
              ];
              targetForce = 0.18 + 0.25 * binAmp + 0.12 * beatInfo.beatStrength;
            } else {
              // Leaves - floating around branches
              const leafAngle = (treePos - 60) * 0.1 + (isPlaying ? t * 0.04 : 0) + treeId;
              const leafRadius = 25 + 15 * binAmp + beatInfo.beatStrength * 10;
              const leafHeight = 40 + Math.sin((isPlaying ? t * 0.025 : 0) + treePos) * 20;
              const leafDrift = Math.sin((isPlaying ? t * 0.05 : 0) + treePos * 0.3) * 8;
              target = [
                Math.cos(treeAngle) * treeSpacing + Math.cos(leafAngle) * leafRadius + leafDrift,
                leafHeight,
                Math.sin(treeAngle) * treeSpacing + Math.sin(leafAngle) * leafRadius + leafDrift,
              ];
              targetForce = 0.15 + 0.2 * binAmp + 0.1 * beatInfo.beatStrength;
            }
          }
          
          // Apply forces for realistic physics
          if (isPlaying) {
            // Calculate force towards target
            const dx = target[0] - positions.array[i * 3];
            const dy = target[1] - positions.array[i * 3 + 1];
            const dz = target[2] - positions.array[i * 3 + 2];
            // Apply spring force towards target
            const springForce = targetForce * 0.1;
            forces[i * 3] += dx * springForce;
            forces[i * 3 + 1] += dy * springForce;
            forces[i * 3 + 2] += dz * springForce;
            // Add damping force
            const damping = 0.98;
            velocities[i * 3] *= damping;
            velocities[i * 3 + 1] *= damping;
            velocities[i * 3 + 2] *= damping;
            // Update velocities with forces
            velocities[i * 3] += forces[i * 3] / mass;
            velocities[i * 3 + 1] += forces[i * 3 + 1] / mass;
            velocities[i * 3 + 2] += forces[i * 3 + 2] / mass;
            // Update positions
            positions.array[i * 3] += velocities[i * 3];
            positions.array[i * 3 + 1] += velocities[i * 3 + 1];
            positions.array[i * 3 + 2] += velocities[i * 3 + 2];
          }
          
          // Advanced color calculations with beat-driven effects
          const baseBrightness = 0.6 + 0.4 * binAmp;
          const beatBrightness = beatInfo.isBeat ? beatInfo.beatStrength * 0.6 : 0;
          const harmonicBrightness = spectrumInfo.harmonicContent * 0.4;
          const rhythmBrightness = spectrumInfo.rhythmComplexity * 0.3;
          const finalBrightness = baseBrightness + beatBrightness + harmonicBrightness + rhythmBrightness;

          // Apply visual style-specific colors with enhanced music responsiveness
          if (visualStyle === 'nebula') {
            const hue = (i / PARTICLE_COUNT) * 0.5 + 0.5;
            const nebulaPulse = beatInfo.isBeat ? beatInfo.beatStrength * 0.3 : 0;
            const harmonicGlow = spectrumInfo.harmonicContent * 0.2;
            colors.array[i * 3] = finalBrightness * (0.5 + 0.5 * Math.sin(hue * Math.PI) + nebulaPulse + harmonicGlow);
            colors.array[i * 3 + 1] = finalBrightness * (0.2 + 0.8 * Math.sin(hue * Math.PI + 2) + nebulaPulse + harmonicGlow);
            colors.array[i * 3 + 2] = finalBrightness * (0.7 + 0.3 * Math.sin(hue * Math.PI + 4) + nebulaPulse + harmonicGlow);
          } else if (visualStyle === 'matrix') {
            const intensity = 0.2 + 0.8 * Math.sin((isPlaying ? t * 0.04 : 0) + i * 0.1);
            const matrixPulse = beatInfo.isBeat ? beatInfo.beatStrength * 0.4 : 0;
            const dataFlow = spectrumInfo.rhythmComplexity * 0.3;
            colors.array[i * 3] = (0.1 + matrixPulse + dataFlow) * intensity * finalBrightness;
            colors.array[i * 3 + 1] = (0.9 + matrixPulse + dataFlow) * intensity * finalBrightness;
            colors.array[i * 3 + 2] = (0.2 + matrixPulse + dataFlow) * intensity * finalBrightness;
          } else if (visualStyle === 'lightning') {
            const electricPulse = Math.sin((isPlaying ? t * 0.5 : 0) + i * 0.1) * 0.3 + 0.7;
            const lightningStrike = beatInfo.isBeat ? beatInfo.beatStrength * 0.5 : 0;
            const electricArc = spectrumInfo.harmonicContent * 0.4;
            colors.array[i * 3] = (0.7 + lightningStrike + electricArc) * electricPulse * finalBrightness;
            colors.array[i * 3 + 1] = (0.8 + lightningStrike + electricArc) * electricPulse * finalBrightness;
            colors.array[i * 3 + 2] = (1.0 + lightningStrike + electricArc) * electricPulse * finalBrightness;
          } else if (visualStyle === 'fireworks') {
            const fireworkType = (i % 8) % 4;
            const sparkle = beatInfo.isBeat ? beatInfo.beatStrength * 0.6 : 0.3;
            const explosionGlow = spectrumInfo.overall * 0.4;
            if (fireworkType === 0) {
              colors.array[i * 3] = (finalBrightness + sparkle + explosionGlow);
              colors.array[i * 3 + 1] = (0.6 * finalBrightness + sparkle + explosionGlow);
              colors.array[i * 3 + 2] = (0.2 * finalBrightness + sparkle + explosionGlow);
            } else if (fireworkType === 1) {
              colors.array[i * 3] = (0.3 * finalBrightness + sparkle + explosionGlow);
              colors.array[i * 3 + 1] = (0.7 * finalBrightness + sparkle + explosionGlow);
              colors.array[i * 3 + 2] = (finalBrightness + sparkle + explosionGlow);
            } else if (fireworkType === 2) {
              colors.array[i * 3] = (0.8 * finalBrightness + sparkle + explosionGlow);
              colors.array[i * 3 + 1] = (0.4 * finalBrightness + sparkle + explosionGlow);
              colors.array[i * 3 + 2] = (finalBrightness + sparkle + explosionGlow);
            } else {
              colors.array[i * 3] = (finalBrightness + sparkle + explosionGlow);
              colors.array[i * 3 + 1] = (finalBrightness + sparkle + explosionGlow);
              colors.array[i * 3 + 2] = (finalBrightness + sparkle + explosionGlow);
            }
          } else if (visualStyle === 'sphere') {
            const spherePulse = beatInfo.isBeat ? beatInfo.beatStrength * 0.4 : 0;
            const harmonicResonance = spectrumInfo.harmonicContent * 0.3;
            colors.array[i * 3] = (finalBrightness + spherePulse + harmonicResonance);
            colors.array[i * 3 + 1] = (finalBrightness + spherePulse + harmonicResonance);
            colors.array[i * 3 + 2] = (finalBrightness + spherePulse + harmonicResonance);
          } else if (visualStyle === 'vortex') {
            const vortexSpin = Math.sin(t * 0.02 + i * 0.1) * 0.2;
            const energyWave = beatInfo.isBeat ? beatInfo.beatStrength * 0.3 : 0;
            const depthGlow = spectrumInfo.rhythmComplexity * 0.2;
            colors.array[i * 3] = (finalBrightness + vortexSpin + energyWave + depthGlow) * 0.3;
            colors.array[i * 3 + 1] = (finalBrightness + vortexSpin + energyWave + depthGlow) * 0.1;
            colors.array[i * 3 + 2] = (finalBrightness + vortexSpin + energyWave + depthGlow) * 0.8;
          } else if (visualStyle === 'crystal') {
            const crystalReflection = Math.sin(t * 0.02 + i * 0.1) * 0.3;
            const prismaticGlow = beatInfo.isBeat ? beatInfo.beatStrength * 0.5 : 0;
            const harmonicCrystal = spectrumInfo.harmonicContent * 0.4;
            colors.array[i * 3] = (finalBrightness + crystalReflection + prismaticGlow + harmonicCrystal);
            colors.array[i * 3 + 1] = (finalBrightness + crystalReflection + prismaticGlow + harmonicCrystal);
            colors.array[i * 3 + 2] = (finalBrightness + crystalReflection + prismaticGlow + harmonicCrystal);
          } else if (visualStyle === 'forest') {
            // Forest colors with seasonal changes
            const treeCount = 8;
            const treeId = i % treeCount;
            const treePos = Math.floor(i / treeCount);
            // Seasonal progression based on audio energy
            const seasonalCycle = (Math.sin(t * 0.001) + 1) * 0.5; // 0-1 cycle
            const audioSeason = spectrumInfo.overall * 0.3 + beatInfo.beatStrength * 0.2;
            const currentSeason = (seasonalCycle + audioSeason) % 1;
            if (treePos < 20) {
              // Tree trunk - brown with growth rings
              const trunkGrowth = beatInfo.beatStrength * 0.4;
              colors.array[i * 3] = (0.4 + trunkGrowth) * finalBrightness; // Brown
              colors.array[i * 3 + 1] = (0.2 + trunkGrowth) * finalBrightness;
              colors.array[i * 3 + 2] = (0.1 + trunkGrowth) * finalBrightness;
            } else if (treePos >= 20 && treePos < 60) {
              // Branches - darker brown
              const branchHealth = spectrumInfo.harmonicContent * 0.3;
              colors.array[i * 3] = (0.3 + branchHealth) * finalBrightness;
              colors.array[i * 3 + 1] = (0.15 + branchHealth) * finalBrightness;
              colors.array[i * 3 + 2] = (0.05 + branchHealth) * finalBrightness;
            } else {
              // Leaves - seasonal colors
              let leafR, leafG, leafB;
              if (currentSeason < 0.25) {
                // Spring - bright green
                leafR = 0.2; leafG = 0.8; leafB = 0.3;
              } else if (currentSeason < 0.5) {
                // Summer - deep green
                leafR = 0.1; leafG = 0.6; leafB = 0.2;
              } else if (currentSeason < 0.75) {
                // Autumn - orange/red
                leafR = 0.8; leafG = 0.4; leafB = 0.1;
              } else {
                // Winter - white/blue
                leafR = 0.7; leafG = 0.8; leafB = 1.0;
              }
              // Beat detection causes leaves to fall (color changes)
              const leafFall = beatInfo.isBeat ? beatInfo.beatStrength * 0.3 : 0;
              const leafHealth = spectrumInfo.rhythmComplexity * 0.2;
              colors.array[i * 3] = (leafR + leafFall + leafHealth) * finalBrightness;
              colors.array[i * 3 + 1] = (leafG + leafFall + leafHealth) * finalBrightness;
              colors.array[i * 3 + 2] = (leafB + leafFall + leafHealth) * finalBrightness;
            }
          }
        }
        
        positions.needsUpdate = true;
        colors.needsUpdate = true;
      }
      
      t += 1;
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      if (running) animationIdRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      running = false;
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (controls) controls.dispose();
    };
  }, [isPlaying, visualStyle]);

  // Helper for frequency analysis
  function getAverage(data: Uint8Array, start: number, end: number) {
    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += data[i];
    }
    return sum / (end - start);
  }

  // Track current playback time and call onTimeUpdate
  useEffect(() => {
    let raf: number;
    function updateTime() {
      if (isPlaying && audioBufferRef.current) {
        const now = audioContextRef.current?.currentTime || 0;
        const elapsed = now - startTimeRef.current + lastSeekRef.current;
        if (elapsed <= audioBufferRef.current.duration) {
          onTimeUpdate(elapsed);
        }
      }
      raf = requestAnimationFrame(updateTime);
    }
    updateTime();
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, onTimeUpdate]);

  // Handle seekValue prop: seek audio when changed
  useEffect(() => {
    if (isMobileSafari) {
      // Safari seek handling
      if (safariAudioRef.current && Math.abs(seekValue - lastSeekRef.current) >= 0.1) {
        safariAudioRef.current.currentTime = seekValue;
        lastSeekRef.current = seekValue;
        onTimeUpdate(seekValue);
        console.log('Safari audio seeked to:', seekValue);
      }
      return;
    }
    
    if (!audioBufferRef.current || !audioContextRef.current) return;
    if (Math.abs(seekValue - lastSeekRef.current) < 0.1) return; // Avoid tiny changes
    
    // Always stop current source first
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (e) {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    lastSeekRef.current = seekValue;
    onTimeUpdate(seekValue);
    
    if (!isPlaying) {
      pausedAtRef.current = seekValue;
      return;
    }
    
    // Start new source at seekValue
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    
    // Check if we're recording and need to use splitter
    if (audioDestinationRef.current) {
      // Use splitter pattern for recording
      const splitter = audioContextRef.current.createGain();
      source.connect(splitter);
      splitter.connect(audioDestinationRef.current);
      
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      splitter.connect(analyser);
      analyser.connect(audioContextRef.current.destination);
    } else {
      // Normal playback without recording
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // Add a gain node for volume control (especially important for mobile)
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 1.0; // Full volume
      
      source.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(audioContextRef.current.destination);
    }
    
    sourceRef.current = source;
    startTimeRef.current = audioContextRef.current.currentTime;
    source.start(0, seekValue);
    source.onended = () => setIsPlaying(false);
  }, [seekValue, isPlaying, onTimeUpdate, isMobileSafari]);

  // When play/pause changes, start/stop audio at correct position
  useEffect(() => {
    if (!audioBufferRef.current && !isMobileSafari) return;
    
    if (isPlaying) {
      // Safari-specific audio handling
      if (isMobileSafari) {
        console.log('Starting Safari audio playback');
        
        // Create audio element if it doesn't exist
        if (!safariAudioRef.current) {
          const audio = new Audio();
          
          if (typeof audioSource === 'string') {
            audio.src = audioSource;
          } else {
            // Create object URL for file
            const objectUrl = URL.createObjectURL(audioSource);
            audio.src = objectUrl;
          }
          
          audio.preload = 'metadata';
          audio.crossOrigin = 'anonymous';
          
          // Set up audio analysis for Safari
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const source = audioContext.createMediaElementSource(audio);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;
          
          source.connect(analyser);
          analyser.connect(audioContext.destination);
          
          // Set up time tracking
          audio.addEventListener('timeupdate', () => {
            onTimeUpdate(audio.currentTime);
          });
          
          audio.addEventListener('loadedmetadata', () => {
            onDuration(audio.duration);
            console.log('Safari audio loaded, duration:', audio.duration);
          });
          
          audio.addEventListener('ended', () => {
            setIsPlaying(false);
          });
          
          safariAudioRef.current = audio;
        }
        
        // Start playback
        const audio = safariAudioRef.current;
        if (audio) {
          audio.currentTime = pausedAtRef.current || lastSeekRef.current || 0;
          audio.play().then(() => {
            console.log('Safari audio playback started successfully');
          }).catch(error => {
            console.error('Failed to start Safari audio playback:', error);
            setIsPlaying(false);
          });
        }
        return;
      }
      
      // Regular Web Audio API handling for non-Safari
      const startAudioPlayback = async () => {
        const audioContext = audioContextRef.current;
        if (!audioContext) return;
        
        if (audioContext.state === 'suspended') {
          console.log('Resuming audio context for mobile...');
          try {
            await audioContext.resume();
            console.log('Audio context resumed successfully');
          } catch (error) {
            console.error('Failed to resume audio context:', error);
            return; // Don't start playback if resume failed
          }
        }
        
        // Always stop any existing source first
        if (sourceRef.current) {
          try { sourceRef.current.stop(); } catch (e) {}
          sourceRef.current.disconnect();
          sourceRef.current = null;
        }
        
        // Start from pausedAtRef or lastSeekRef
        const startAt = pausedAtRef.current || lastSeekRef.current || 0;
        const source = audioContext.createBufferSource();
        source.buffer = audioBufferRef.current;
        
        // Normal playback - don't interfere with recording
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        // Add a gain node for volume control (especially important for mobile)
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1.0; // Full volume
        
        source.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(audioContext.destination);
        
        sourceRef.current = source;
        startTimeRef.current = audioContext.currentTime;
        lastSeekRef.current = startAt;
        
        try {
          source.start(0, startAt);
          source.onended = () => setIsPlaying(false);
          console.log('Audio playback started successfully');
        } catch (error) {
          console.error('Failed to start audio playback:', error);
          setIsPlaying(false);
        }
      };
      
      startAudioPlayback();
    } else {
      // Pause logic
      if (isMobileSafari && safariAudioRef.current) {
        // Safari pause
        const audio = safariAudioRef.current;
        pausedAtRef.current = audio.currentTime;
        audio.pause();
        console.log('Safari audio paused at:', audio.currentTime);
      } else if (sourceRef.current && audioContextRef.current) {
        // Regular Web Audio API pause
        const now = audioContextRef.current.currentTime;
        pausedAtRef.current = now - startTimeRef.current + lastSeekRef.current;
        try { sourceRef.current.stop(); } catch (e) {}
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
    }
  }, [isPlaying, isMobileSafari, audioSource, onTimeUpdate, onDuration]);

  // Advanced beat detection and energy analysis
  function detectBeat(freqData: Uint8Array, currentTime: number): { isBeat: boolean, beatStrength: number, energy: number } {
    const bass = getAverage(freqData, 0, 16);
    const mid = getAverage(freqData, 16, 64);
    const treble = getAverage(freqData, 64, 128);
    const overall = getAverage(freqData, 0, freqData.length);
    
    // Enhanced energy calculation with frequency weighting
    let energy = 0;
    let weightedEnergy = 0;
    for (let i = 0; i < freqData.length; i++) {
      const freq = freqData[i] / 255;
      const weight = 1 + (i / freqData.length) * 0.5; // Higher frequencies weighted more
      energy += freq ** 2;
      weightedEnergy += freq ** 2 * weight;
    }
    energy /= freqData.length;
    weightedEnergy /= freqData.length;
    
    // Update energy history with more sophisticated tracking
    energyHistoryRef.current.push(weightedEnergy);
    if (energyHistoryRef.current.length > 30) { // Increased history for better analysis
      energyHistoryRef.current.shift();
    }
    
    // Calculate multiple energy averages for better beat detection
    const recentEnergy = energyHistoryRef.current.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const avgEnergy = energyHistoryRef.current.reduce((a, b) => a + b, 0) / energyHistoryRef.current.length;
    const longTermEnergy = energyHistoryRef.current.slice(0, -10).reduce((a, b) => a + b, 0) / Math.max(1, energyHistoryRef.current.length - 10);
    
    // Enhanced beat detection with multiple criteria
    const energySpike = Math.max(0, (weightedEnergy - recentEnergy) / Math.max(recentEnergy, 0.1));
    const bassKick = Math.max(0, (bass - getAverage(freqData, 0, 8)) / Math.max(getAverage(freqData, 0, 8), 0.1));
    const rhythmChange = Math.abs(weightedEnergy - avgEnergy) / Math.max(avgEnergy, 0.1);
    
    // Combined beat strength calculation
    const beatStrength = (energySpike * 0.4 + bassKick * 0.4 + rhythmChange * 0.2) * 2;
    
    // Adaptive threshold based on music characteristics
    const musicIntensity = Math.max(bass, mid, treble);
    const dynamicThreshold = Math.max(0.2, Math.min(0.8, beatThresholdRef.current * (1 + musicIntensity * 0.5)));
    
    const isBeat = beatStrength > dynamicThreshold && 
                   (currentTime - lastBeatTimeRef.current) > 0.08 && // Slightly faster minimum interval
                   weightedEnergy > avgEnergy * 1.1; // Must be above average energy
    
    if (isBeat) {
      lastBeatTimeRef.current = currentTime;
      beatHistoryRef.current.push(beatStrength);
      if (beatHistoryRef.current.length > 15) {
        beatHistoryRef.current.shift();
      }
      
      // More sophisticated adaptive threshold
      const avgBeatStrength = beatHistoryRef.current.reduce((a, b) => a + b, 0) / beatHistoryRef.current.length;
      const beatVariance = beatHistoryRef.current.reduce((sum, val) => sum + (val - avgBeatStrength) ** 2, 0) / beatHistoryRef.current.length;
      beatThresholdRef.current = Math.max(0.2, Math.min(0.9, avgBeatStrength * 0.7 + beatVariance * 0.3));
    }
    
    return { isBeat, beatStrength: Math.min(2.0, beatStrength), energy: weightedEnergy };
  }
  
  // Advanced frequency analysis with harmonic detection
  function analyzeFrequencySpectrum(freqData: Uint8Array): {
    bass: number, mid: number, treble: number, overall: number,
    bassPeak: number, midPeak: number, treblePeak: number,
    harmonicContent: number, rhythmComplexity: number
  } {
    const bass = getAverage(freqData, 0, 16);
    const mid = getAverage(freqData, 16, 64);
    const treble = getAverage(freqData, 64, 128);
    const overall = getAverage(freqData, 0, freqData.length);
    
    // Find frequency peaks
    const bassPeak = Math.max(...freqData.slice(0, 16)) / 255;
    const midPeak = Math.max(...freqData.slice(16, 64)) / 255;
    const treblePeak = Math.max(...freqData.slice(64, 128)) / 255;
    
    // Harmonic content analysis
    let harmonicContent = 0;
    for (let i = 1; i < freqData.length - 1; i++) {
      const current = freqData[i] / 255;
      const prev = freqData[i - 1] / 255;
      const next = freqData[i + 1] / 255;
      if (current > prev && current > next) {
        harmonicContent += current;
      }
    }
    harmonicContent /= freqData.length;
    
    // Rhythm complexity (variation in frequency distribution)
    let rhythmComplexity = 0;
    for (let i = 1; i < freqData.length; i++) {
      rhythmComplexity += Math.abs((freqData[i] / 255) - (freqData[i - 1] / 255));
    }
    rhythmComplexity /= freqData.length;
    
    return {
      bass, mid, treble, overall,
      bassPeak, midPeak, treblePeak,
      harmonicContent, rhythmComplexity
    };
  }

  // Video recording functions
  const startRecording = () => {
    if (!rendererRef.current || !mountRef.current) {
      console.error('Cannot start recording: missing required components');
      return;
    }
    
    const canvas = rendererRef.current.domElement;
    canvasRef.current = canvas;
    
    // Detect if we're on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    try {
      if (isMobile) {
        // Mobile-specific recording approach - simple screenshot
        startMobileScreenshotRecording(canvas);
      } else {
        // Desktop recording approach
        startDesktopRecording(canvas);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Please check browser permissions and try again.');
    }
  };

  const startMobileScreenshotRecording = (canvas: HTMLCanvasElement) => {
    console.log('Starting mobile screenshot recording...');
    
    // Take a single screenshot and save it
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          const fileName = `music-visualizer-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
          
          // Try Web Share API first
          if ('navigator' in window && 'share' in navigator && navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] })) {
            const file = new File([blob], fileName, { type: 'image/png' });
            
            navigator.share({
              title: 'Music Visualizer Screenshot',
              text: 'Check out this music visualization!',
              files: [file]
            }).then(() => {
              console.log('Screenshot shared successfully');
              alert('Screenshot shared! You can save it to your device from the share menu.');
            }).catch((error) => {
              console.log('Web Share API failed, trying fallback:', error);
              downloadFile(blob, fileName);
            });
          } else {
            // Fallback to download
            downloadFile(blob, fileName);
            alert('Screenshot saved! Check your Downloads folder.');
          }
        } else {
          alert('Failed to capture screenshot. Please try again.');
        }
      }, 'image/png', 0.9);
      
      console.log('Mobile screenshot captured successfully');
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      alert('Failed to capture screenshot. Please try again.');
    }
  };

  const startDesktopRecording = (canvas: HTMLCanvasElement) => {
    // Capture video stream from canvas
    const videoStream = canvas.captureStream(60); // 60 FPS
    
    // Create audio destination for recording
    const audioDestination = audioContextRef.current!.createMediaStreamDestination();
    audioDestinationRef.current = audioDestination;
    
    // Create a splitter to route audio to both playback and recording
    if (sourceRef.current) {
      // Create a gain node to split the audio
      const splitter = audioContextRef.current!.createGain();
      
      // Disconnect current connections
      sourceRef.current.disconnect();
      
      // Connect source to splitter
      sourceRef.current.connect(splitter);
      
      // Connect splitter to both destinations
      splitter.connect(audioDestination); // For recording
      
      // Recreate analyser and connect to playback
      const analyser = audioContextRef.current!.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      splitter.connect(analyser);
      analyser.connect(audioContextRef.current!.destination);
    }
    
    // Combine video and audio streams
    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks()
    ]);
    
    // Check for supported MIME types
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm'
    ];
    
    let selectedMimeType = 'video/webm';
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        break;
      }
    }
    
    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType: selectedMimeType,
      videoBitsPerSecond: 8000000 // 8 Mbps for high quality
    });
    
    mediaRecorderRef.current = mediaRecorder;
    recordedChunksRef.current = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `music-visualizer-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Clean up audio destination
      if (audioDestinationRef.current) {
        audioDestinationRef.current.disconnect();
        audioDestinationRef.current = null;
      }
      
      console.log('Recording completed and downloaded');
    };
    
    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      alert('Recording failed. Please try again.');
    };
    
    mediaRecorder.start();
    console.log('Desktop recording started with audio and video');
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      console.log('Desktop recording stopped - processing video...');
    } else {
      console.log('Mobile screenshot already captured');
    }
  };

  const saveToMobileGallery = (blob: Blob, mimeType: string) => {
    // Try to save to mobile gallery using various methods
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    const fileName = `music-visualizer-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${mimeType.includes('gif') ? 'gif' : 'webm'}`;
    
    console.log(`Saving recording: ${fileName}, size: ${blob.size} bytes`);
    
    // Try Web Share API first (works on most modern mobile browsers)
    if ('navigator' in window && 'share' in navigator && navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: mimeType })] })) {
      const file = new File([blob], fileName, { type: mimeType });
      
      navigator.share({
        title: 'Music Visualizer Recording',
        text: 'Check out this music visualization recording!',
        files: [file]
      }).then(() => {
        console.log('Recording shared successfully');
        alert('Recording shared! You can save it to your device from the share menu.');
      }).catch((error) => {
        console.log('Web Share API failed, trying fallback:', error);
        // Fallback to download
        downloadFile(blob, fileName);
      });
    } else if (isIOS && isSafari) {
      // iOS Safari specific handling
      if ('webkit' in window && 'messageHandlers' in (window as any).webkit) {
        // iOS WebView with native bridge
        const url = URL.createObjectURL(blob);
        (window as any).webkit.messageHandlers.saveToPhotos.postMessage(url);
        alert('Recording saved to Photos!');
      } else {
        // iOS Safari fallback
        downloadFile(blob, fileName);
        alert('Recording saved! Check your Downloads folder or Photos app.');
      }
    } else {
      // Android/other mobile browsers
      downloadFile(blob, fileName);
      alert('Recording saved! Check your Downloads folder.');
    }
    
    console.log('Mobile recording completed and saved');
  };

  const downloadFile = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Expose recording functions to parent component
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).startVisualizerRecording = startRecording;
      (window as any).stopVisualizerRecording = stopRecording;
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).startVisualizerRecording;
        delete (window as any).stopVisualizerRecording;
      }
    };
  }, []);

  // Clean up audio destination when recording stops
  useEffect(() => {
    if (!isRecording && audioDestinationRef.current) {
      audioDestinationRef.current.disconnect();
      audioDestinationRef.current = null;
    }
  }, [isRecording]);

  // Helper to fully clean up Three.js scene and renderer
  function cleanupThreeJS() {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    if (mountRef.current) {
      mountRef.current.innerHTML = "";
    }
    sceneRef.current = null;
    cameraRef.current = null;
    particlesRef.current = null;
  }

  // Clean up Three.js when switching to ASCII
  useEffect(() => {
    if (visualStyle === 'ascii') {
      // Clean up Three.js scene if switching to ASCII
      cleanupThreeJS();
    }
    // Only run when visualStyle changes
  }, [visualStyle]);

  return (
    <div 
      ref={mountRef} 
      style={{ width: '100%', height: '100%' }}
      onClick={initializeMobileAudio}
      onTouchStart={initializeMobileAudio}
    />
  );
} 