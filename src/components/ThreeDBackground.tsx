import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Props {
  isDark: boolean;
}

export default function ThreeDBackground({ isDark }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDarkRef = useRef(isDark);

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer (Mounted once)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.5, 33);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDarkRef.current ? 1.35 : 1.15;
    container.appendChild(renderer.domElement);

    // 2. Soft Ambient Fog
    const fogColor = new THREE.Color(isDarkRef.current ? 0x141417 : 0xf1f5f9);
    scene.fog = new THREE.FogExp2(fogColor, 0.014);

    // 3. 6 Completely Randomized & Unique Liquid Glass Ribbons
    const ribbonConfigs = [
      {
        width: 5.2,
        darkColor: 0x38bdf8,
        darkEmissive: 0x0369a1,
        lightColor: 0x2563eb,
        lightEmissive: 0x93c5fd,
        xSpan: 64,
        yBase: 1.5,
        zBase: 4,
        // Harmonic Frequencies & Speeds
        f1: 0.068, a1: 7.2, s1: 0.14, p1: 0.2,
        f2: 0.135, a2: 2.4, s2: -0.11, p2: 1.8,
        f3: 0.042, a3: 3.1, s3: 0.08, p3: 3.4,
        twistF1: 0.09, twistS1: 0.12, maxTwist: 1.6, twistPhase: 0.5,
        twistF2: 0.04, twistS2: -0.07,
        zF1: 0.055, zS1: 0.1, zAmp: 4.5,
        swellSpeed: 0.09,
      },
      {
        width: 6.0,
        darkColor: 0x818cf8,
        darkEmissive: 0x3730a3,
        lightColor: 0x4f46e5,
        lightEmissive: 0xa5b4fc,
        xSpan: 68,
        yBase: -2.2,
        zBase: -2,
        f1: 0.058, a1: 8.8, s1: -0.12, p1: 2.1,
        f2: 0.112, a2: 2.8, s2: 0.15, p2: 0.9,
        f3: 0.035, a3: 3.6, s3: -0.09, p3: 4.5,
        twistF1: 0.075, twistS1: -0.11, maxTwist: 1.8, twistPhase: 2.2,
        twistF2: 0.03, twistS2: 0.06,
        zF1: 0.048, zS1: -0.08, zAmp: 5.2,
        swellSpeed: 0.07,
      },
      {
        width: 3.6,
        darkColor: 0xc084fc,
        darkEmissive: 0x6b21a8,
        lightColor: 0x9333ea,
        lightEmissive: 0xd8b4fe,
        xSpan: 58,
        yBase: 4.2,
        zBase: -6,
        f1: 0.082, a1: 6.0, s1: 0.16, p1: 4.3,
        f2: 0.155, a2: 1.9, s2: -0.13, p2: 2.7,
        f3: 0.052, a3: 2.2, s3: 0.11, p3: 1.1,
        twistF1: 0.11, twistS1: 0.15, maxTwist: 1.4, twistPhase: 1.4,
        twistF2: 0.05, twistS2: -0.09,
        zF1: 0.065, zS1: 0.13, zAmp: 3.8,
        swellSpeed: 0.11,
      },
      {
        width: 4.4,
        darkColor: 0x06b6d4,
        darkEmissive: 0x0e7490,
        lightColor: 0x0284c7,
        lightEmissive: 0x7dd3fc,
        xSpan: 60,
        yBase: -4.8,
        zBase: 6,
        f1: 0.062, a1: 7.6, s1: 0.11, p1: 1.4,
        f2: 0.125, a2: 2.2, s2: 0.14, p2: 5.1,
        f3: 0.044, a3: 2.9, s3: -0.07, p3: 2.6,
        twistF1: 0.085, twistS1: 0.1, maxTwist: 1.5, twistPhase: 3.8,
        twistF2: 0.038, twistS2: -0.08,
        zF1: 0.052, zS1: 0.09, zAmp: 4.8,
        swellSpeed: 0.08,
      },
      {
        width: 4.0,
        darkColor: 0xec4899,
        darkEmissive: 0x831843,
        lightColor: 0xdb2777,
        lightEmissive: 0xfbcfe8,
        xSpan: 56,
        yBase: 2.8,
        zBase: -9,
        f1: 0.074, a1: 6.8, s1: -0.15, p1: 3.2,
        f2: 0.142, a2: 2.0, s2: 0.12, p2: 0.4,
        f3: 0.048, a3: 2.5, s3: 0.09, p3: 4.0,
        twistF1: 0.095, twistS1: -0.14, maxTwist: 1.7, twistPhase: 4.9,
        twistF2: 0.042, twistS2: 0.07,
        zF1: 0.06, zS1: -0.11, zAmp: 4.2,
        swellSpeed: 0.1,
      },
      {
        width: 4.9,
        darkColor: 0x6366f1,
        darkEmissive: 0x312e81,
        lightColor: 0x4338ca,
        lightEmissive: 0xc7d2fe,
        xSpan: 66,
        yBase: -0.8,
        zBase: 8,
        f1: 0.052, a1: 8.2, s1: 0.13, p1: 5.6,
        f2: 0.108, a2: 2.5, s2: -0.1, p2: 3.3,
        f3: 0.038, a3: 3.4, s3: 0.06, p3: 1.7,
        twistF1: 0.07, twistS1: 0.09, maxTwist: 1.5, twistPhase: 0.8,
        twistF2: 0.032, twistS2: -0.05,
        zF1: 0.044, zS1: 0.07, zAmp: 5.5,
        swellSpeed: 0.06,
      },
    ];

    const numRibbonSegments = 120;
    const ribbonsData: Array<{
      mesh: THREE.Mesh;
      material: THREE.MeshPhysicalMaterial;
      topEdgeLine: THREE.Line;
      bottomEdgeLine: THREE.Line;
      edgeMaterial: THREE.LineBasicMaterial;
      geometry: THREE.BufferGeometry;
      topEdgeGeo: THREE.BufferGeometry;
      bottomEdgeGeo: THREE.BufferGeometry;
      config: typeof ribbonConfigs[0];
    }> = [];

    ribbonConfigs.forEach((config) => {
      const vertexCount = (numRibbonSegments + 1) * 2;
      const positions = new Float32Array(vertexCount * 3);
      const normals = new Float32Array(vertexCount * 3);
      const uvs = new Float32Array(vertexCount * 2);
      const indices: number[] = [];

      for (let i = 0; i < numRibbonSegments; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = (i + 1) * 2;
        const d = (i + 1) * 2 + 1;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(indices);

      const isInitiallyDark = isDarkRef.current;
      const material = new THREE.MeshPhysicalMaterial({
        color: isInitiallyDark ? config.darkColor : config.lightColor,
        emissive: isInitiallyDark ? config.darkEmissive : config.lightEmissive,
        emissiveIntensity: isInitiallyDark ? 0.28 : 0.12,
        roughness: 0.08,
        metalness: 0.15,
        transmission: isInitiallyDark ? 0.78 : 0.82,
        ior: 1.5,
        transparent: true,
        opacity: isInitiallyDark ? 0.85 : 0.75,
        side: THREE.DoubleSide,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const topEdgePositions = new Float32Array((numRibbonSegments + 1) * 3);
      const bottomEdgePositions = new Float32Array((numRibbonSegments + 1) * 3);

      const topEdgeGeo = new THREE.BufferGeometry();
      topEdgeGeo.setAttribute('position', new THREE.BufferAttribute(topEdgePositions, 3));

      const bottomEdgeGeo = new THREE.BufferGeometry();
      bottomEdgeGeo.setAttribute('position', new THREE.BufferAttribute(bottomEdgePositions, 3));

      const edgeMaterial = new THREE.LineBasicMaterial({
        color: isInitiallyDark ? 0xffffff : config.lightColor,
        transparent: true,
        opacity: isInitiallyDark ? 0.55 : 0.35,
        blending: THREE.AdditiveBlending,
      });

      const topEdgeLine = new THREE.Line(topEdgeGeo, edgeMaterial);
      const bottomEdgeLine = new THREE.Line(bottomEdgeGeo, edgeMaterial);
      scene.add(topEdgeLine);
      scene.add(bottomEdgeLine);

      ribbonsData.push({
        mesh,
        material,
        topEdgeLine,
        bottomEdgeLine,
        edgeMaterial,
        geometry,
        topEdgeGeo,
        bottomEdgeGeo,
        config,
      });
    });

    // 4. Ambient Sparkles
    const dustCount = 140;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);

    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 60;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 35;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 35;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

    const dustMaterial = new THREE.PointsMaterial({
      color: isDarkRef.current ? 0x93c5fd : 0x6366f1,
      size: 0.22,
      transparent: true,
      opacity: isDarkRef.current ? 0.55 : 0.35,
      blending: THREE.AdditiveBlending,
    });
    const dustMesh = new THREE.Points(dustGeo, dustMaterial);
    scene.add(dustMesh);

    // 5. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, isDarkRef.current ? 0.7 : 1.3);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, isDarkRef.current ? 2.4 : 3.0);
    keyLight.position.set(12, 18, 16);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, isDarkRef.current ? 1.8 : 1.2);
    rimLight.position.set(-15, -10, -10);
    scene.add(rimLight);

    const accentLight1 = new THREE.PointLight(0x06b6d4, isDarkRef.current ? 55 : 30, 80);
    accentLight1.position.set(-12, 6, 10);
    scene.add(accentLight1);

    const accentLight2 = new THREE.PointLight(0xa855f7, isDarkRef.current ? 65 : 35, 80);
    accentLight2.position.set(12, -4, 8);
    scene.add(accentLight2);

    // 6. Interactive Mouse Parallax Tracking
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // 7. Organic, Non-Repeating 60FPS Render Loop
    let animationFrameId: number;
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = (performance.now() - startTime) * 0.001;
      const isDarkActive = isDarkRef.current;

      // Smoothly update theme settings
      renderer.toneMappingExposure += ((isDarkActive ? 1.35 : 1.15) - renderer.toneMappingExposure) * 0.08;

      if (scene.fog) {
        const targetFog = isDarkActive ? new THREE.Color(0x141417) : new THREE.Color(0xf1f5f9);
        (scene.fog as THREE.FogExp2).color.lerp(targetFog, 0.08);
      }

      ambientLight.intensity += ((isDarkActive ? 0.7 : 1.3) - ambientLight.intensity) * 0.08;
      keyLight.intensity += ((isDarkActive ? 2.4 : 3.0) - keyLight.intensity) * 0.08;
      accentLight1.intensity += ((isDarkActive ? 55 : 30) - accentLight1.intensity) * 0.08;
      accentLight2.intensity += ((isDarkActive ? 65 : 35) - accentLight2.intensity) * 0.08;

      // Smooth camera interpolation
      targetX += (mouseX - targetX) * 0.025;
      targetY += (mouseY - targetY) * 0.025;

      camera.position.x = targetX * 3.5;
      camera.position.y = 1.5 - targetY * 2.5;
      camera.lookAt(0, 0, 0);

      // Deform and twist ribbons with completely independent organic multi-harmonics
      ribbonsData.forEach(({ material, edgeMaterial, geometry, topEdgeGeo, bottomEdgeGeo, config }) => {
        const targetColor = new THREE.Color(isDarkActive ? config.darkColor : config.lightColor);
        const targetEmissive = new THREE.Color(isDarkActive ? config.darkEmissive : config.lightEmissive);
        material.color.lerp(targetColor, 0.08);
        material.emissive.lerp(targetEmissive, 0.08);
        material.emissiveIntensity += ((isDarkActive ? 0.28 : 0.12) - material.emissiveIntensity) * 0.08;

        const targetEdgeColor = new THREE.Color(isDarkActive ? 0xffffff : config.lightColor);
        edgeMaterial.color.lerp(targetEdgeColor, 0.08);

        const posAttr = geometry.attributes.position as THREE.BufferAttribute;
        const normAttr = geometry.attributes.normal as THREE.BufferAttribute;
        const topPosAttr = topEdgeGeo.attributes.position as THREE.BufferAttribute;
        const botPosAttr = bottomEdgeGeo.attributes.position as THREE.BufferAttribute;

        const halfWidth = config.width * 0.5;

        // Slow organic swell in overall height
        const verticalSwell = Math.sin(elapsedTime * config.swellSpeed + config.p1) * 2.2;

        for (let i = 0; i <= numRibbonSegments; i++) {
          const t = i / numRibbonSegments;
          const x = (t - 0.5) * config.xSpan;

          // Organic Multi-Harmonic Wave Equation
          const wave1 = Math.sin(x * config.f1 + elapsedTime * config.s1 + config.p1) * config.a1;
          const wave2 = Math.cos(x * config.f2 + elapsedTime * config.s2 + config.p2) * config.a2;
          const wave3 = Math.sin((x * config.f3 + elapsedTime * config.s3) * 0.5 + config.p3) * config.a3;
          const y = wave1 + wave2 + wave3 + verticalSwell + config.yBase;

          // Independent Z-depth oscillation
          const zWave = Math.cos(x * config.zF1 + elapsedTime * config.zS1 + config.p2) * config.zAmp;
          const zFloat = Math.sin(elapsedTime * (config.swellSpeed * 0.8) + config.p3) * 2.8;
          const z = zWave + zFloat + config.zBase;

          // Random Organic Multi-Octave Twist
          const twist1 = Math.sin(x * config.twistF1 + elapsedTime * config.twistS1 + config.twistPhase) * config.maxTwist;
          const twist2 = Math.cos(x * config.twistF2 + elapsedTime * config.twistS2) * (config.maxTwist * 0.35);
          const twistAngle = twist1 + twist2;

          const cosTwist = Math.cos(twistAngle);
          const sinTwist = Math.sin(twistAngle);

          // Binormal displacement vectors
          const by = cosTwist * halfWidth;
          const bz = sinTwist * halfWidth;

          // Normal vector for lighting
          const ny = -sinTwist;
          const nz = cosTwist;

          const topX = x;
          const topY = y + by;
          const topZ = z + bz;

          const botX = x;
          const botY = y - by;
          const botZ = z - bz;

          posAttr.setXYZ(i * 2, topX, topY, topZ);
          posAttr.setXYZ(i * 2 + 1, botX, botY, botZ);

          normAttr.setXYZ(i * 2, 0, ny, nz);
          normAttr.setXYZ(i * 2 + 1, 0, ny, nz);

          topPosAttr.setXYZ(i, topX, topY, topZ);
          botPosAttr.setXYZ(i, botX, botY, botZ);
        }

        posAttr.needsUpdate = true;
        normAttr.needsUpdate = true;
        topPosAttr.needsUpdate = true;
        botPosAttr.needsUpdate = true;
      });

      // Slowly drift lights
      accentLight1.position.x = Math.sin(elapsedTime * 0.2) * 18;
      accentLight1.position.y = 5 + Math.cos(elapsedTime * 0.25) * 4;

      accentLight2.position.x = Math.cos(elapsedTime * 0.18) * -18;
      accentLight2.position.z = 8 + Math.sin(elapsedTime * 0.22) * 6;

      dustMesh.rotation.y = elapsedTime * 0.012;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      ribbonsData.forEach(r => {
        r.geometry.dispose();
        r.material.dispose();
        r.topEdgeGeo.dispose();
        r.edgeMaterial.dispose();
        r.bottomEdgeGeo.dispose();
      });
      dustGeo.dispose();
      dustMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
