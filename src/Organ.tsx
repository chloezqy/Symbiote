import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AudioAnalyzer } from './AudioAnalyzer';

const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;

const simplexNoiseGLSL = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

  i = mod(i, 289.0 );
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 1.0/7.0;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}
`;

export function Organ({ analyzer }: { analyzer: AudioAnalyzer }) {
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const faceState = useRef({
    eyeL: 1.0,
    eyeR: 1.0,
    mouthCurve: 1.0,
    mouthSkew: 0.0,
    mouthOpen: 0.0,
    blinkL: 1.0,
    blinkR: 1.0,
    blinkTimer: 2.0
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uVolume: { value: 0 },
    uSilence: { value: 0 },
    uSpeak: { value: 0 },
    uInstability: { value: 0 },
    uStutter: { value: 0 },
    uEyeL: { value: 1.0 },
    uEyeR: { value: 1.0 },
    uMouthCurve: { value: 1.0 },
    uMouthSkew: { value: 0.0 },
    uMouthOpen: { value: 0.0 },
    uBlinkL: { value: 1.0 },
    uBlinkR: { value: 1.0 },
    uLookDir: { value: new THREE.Vector2() }
  }), []);

  useFrame((state, delta) => {
    if (analyzer.isInitialized) {
      analyzer.update(delta);
      uniforms.uVolume.value = analyzer.volume;
      uniforms.uSilence.value = analyzer.silenceTime;
      uniforms.uSpeak.value = analyzer.speakTime;
      uniforms.uInstability.value = analyzer.pitchJitter;
      uniforms.uStutter.value = analyzer.stutter;
    } else {
      // Idle animation before mic access
      uniforms.uSilence.value = 2.0; 
    }

    uniforms.uTime.value = state.clock.elapsedTime;

    if (meshRef.current) {
      // Idle floating
      const idleY = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      
      // Attention (scale up and move forward when speaking)
      const targetScale = 1.0 + Math.min(uniforms.uSpeak.value * 0.05, 0.15);
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05);
      
      const targetZ = Math.min(uniforms.uSpeak.value * 0.2, 0.5);
      meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetZ, 0.05);
      meshRef.current.position.y = idleY;
      
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.03;
      meshRef.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.4) * 0.03;
    }

    // --- FACE PHYSICS & ANIMATION ---
    const fs = faceState.current;
    let tEyeL = 1.0, tEyeR = 1.0, tMouthCurve = 1.0, tMouthSkew = 0.0, tMouthOpen = 0.0;

    if (analyzer.uiState === 'STABLE' || !analyzer.isInitialized) {
      tEyeL = 1.1; tEyeR = 1.1; 
      tMouthCurve = 0.6; tMouthSkew = 0.0; 
      tMouthOpen = analyzer.volume * 2.0;
    } else if (analyzer.uiState === 'DEGRADING') {
      tEyeL = 1.3; tEyeR = 0.8; // Asymmetrical
      tMouthCurve = 0.2; tMouthSkew = 0.3; 
      tMouthOpen = analyzer.volume * 1.5 + 0.1;
    } else { // CRITICAL
      tEyeL = 0.6; tEyeR = 0.5; // Drooping/squinting
      tMouthCurve = -1.0; tMouthSkew = -0.5; 
      tMouthOpen = analyzer.volume * 1.0 + 0.3;
    }

    // Lerp (Inertia/Spring)
    const lerpRate = 0.08;
    fs.eyeL = lerp(fs.eyeL, tEyeL, lerpRate);
    fs.eyeR = lerp(fs.eyeR, tEyeR, lerpRate);
    fs.mouthCurve = lerp(fs.mouthCurve, tMouthCurve, lerpRate);
    fs.mouthSkew = lerp(fs.mouthSkew, tMouthSkew, lerpRate);
    fs.mouthOpen = lerp(fs.mouthOpen, tMouthOpen, lerpRate);

    // Blinking
    fs.blinkTimer -= delta;
    if (fs.blinkTimer <= 0) {
      fs.blinkL = 0.0;
      if (analyzer.uiState === 'STABLE' || !analyzer.isInitialized) {
        fs.blinkR = 0.0; // Sync
        fs.blinkTimer = Math.random() * 3.0 + 2.0;
      } else if (analyzer.uiState === 'DEGRADING') {
        fs.blinkR = Math.random() > 0.5 ? 0.0 : 1.0; // Async
        fs.blinkTimer = Math.random() * 2.0 + 0.5;
      } else {
        fs.blinkR = 0.0;
        fs.blinkTimer = Math.random() * 4.0 + 3.0; // Slow/stuck
      }
    }
    
    // Blink recovery
    const blinkRecover = analyzer.uiState === 'CRITICAL' ? 0.05 : 0.2;
    fs.blinkL = lerp(fs.blinkL, 1.0, blinkRecover);
    fs.blinkR = lerp(fs.blinkR, 1.0, blinkRecover);

    // Pupil drift
    const camPos = state.camera.position;
    uniforms.uLookDir.value.set(camPos.x * 0.015, camPos.y * 0.015);

    // Apply to uniforms
    uniforms.uEyeL.value = fs.eyeL;
    uniforms.uEyeR.value = fs.eyeR;
    uniforms.uBlinkL.value = fs.blinkL;
    uniforms.uBlinkR.value = fs.blinkR;
    uniforms.uMouthCurve.value = fs.mouthCurve;
    uniforms.uMouthSkew.value = fs.mouthSkew;
    uniforms.uMouthOpen.value = fs.mouthOpen;
  });

  const onBeforeCompile = (shader: THREE.Shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uVolume = uniforms.uVolume;
    shader.uniforms.uSilence = uniforms.uSilence;
    shader.uniforms.uSpeak = uniforms.uSpeak;
    shader.uniforms.uInstability = uniforms.uInstability;
    shader.uniforms.uStutter = uniforms.uStutter;
    shader.uniforms.uEyeL = uniforms.uEyeL;
    shader.uniforms.uEyeR = uniforms.uEyeR;
    shader.uniforms.uBlinkL = uniforms.uBlinkL;
    shader.uniforms.uBlinkR = uniforms.uBlinkR;
    shader.uniforms.uMouthCurve = uniforms.uMouthCurve;
    shader.uniforms.uMouthSkew = uniforms.uMouthSkew;
    shader.uniforms.uMouthOpen = uniforms.uMouthOpen;
    shader.uniforms.uLookDir = uniforms.uLookDir;

    shader.vertexShader = `
      varying vec3 vPos;
      varying float vBreath;
      uniform float uTime;
      uniform float uVolume;
      uniform float uSilence;
      uniform float uSpeak;
      uniform float uInstability;
      uniform float uStutter;

      ${simplexNoiseGLSL}

      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vPos = position;
      vec3 basePos = position;

      // 3 PHASES OF SILENCE
      float p1 = smoothstep(3.0, 4.5, uSilence);
      float p2 = smoothstep(4.5, 7.0, uSilence);
      float p3 = smoothstep(7.0, 12.0, uSilence);

      // BIOLOGICAL BREATHING
      float breathPhase = fract(uTime * 0.35);
      float inhale = smoothstep(0.0, 0.3, breathPhase);
      float exhale = exp(-(breathPhase - 0.3) * 5.0) * step(0.3, breathPhase);
      float breath = (inhale * step(breathPhase, 0.3) + exhale) * 0.15;
      breath *= 1.0 + snoise(vec3(uTime * 0.5)) * 0.2;
      vBreath = breath;

      // SILENCE BEHAVIORS
      float arrhythmicPhase = uTime * (0.4 + snoise(vec3(uTime * 0.2)) * 0.5);
      float arrhythmicBreath = sin(arrhythmicPhase * 3.1415) * 0.1;
      
      // Phase 2: Asymmetric breathing
      float leftRight = smoothstep(-1.0, 1.0, basePos.x);
      float breathAmp = mix(1.0, mix(1.5, 0.2, leftRight), p2);

      // Phase 2: Localized collapse
      float caveIn = snoise(basePos * 1.5 - uTime * 0.2) * 0.4;
      caveIn *= smoothstep(0.2, 0.8, snoise(basePos * 0.8 + uTime * 0.1));
      
      // Phase 3: Dead zones & Slow drift (NO HIGH FREQ SHAKE)
      float deadZone = smoothstep(0.3, 0.7, snoise(basePos * 1.5 + uTime * 0.05));
      float activityMask = mix(1.0, 1.0 - deadZone, p3);
      float slowDrift = snoise(basePos * 1.2 + uTime * 0.1) * 0.3 * p3;

      float speakFactor = clamp(uSpeak * 2.0, 0.0, 1.0);

      // MINIMAL FACE: MOUTH DEFORMATION
      vec3 mouthPos = normalize(vec3(0.0, -0.15, 0.9));
      float mouthDist = length(normalize(basePos) - mouthPos);
      float mouthMask = 1.0 - smoothstep(0.1, 0.3, mouthDist);
      
      // Mouth opens naturally with breath/volume when stable, unnaturally when unstable
      float mouthOpenStable = uVolume * 0.8 + breath * 2.0;
      float mouthOpenUnstable = mix(uVolume * 0.8, snoise(vec3(uTime * 0.5)) * 0.4, p2);
      float mouthOpen = mix(mouthOpenStable, mouthOpenUnstable, p2);
      
      float mouthDisp = mouthMask * mouthOpen * 0.15;

      float displacement = 0.0;
      displacement += snoise(basePos * 1.5) * 0.08; // Base organic asymmetry
      
      float activeBreath = mix(arrhythmicBreath, breath + uVolume * 0.5, speakFactor);
      displacement += activeBreath * breathAmp * activityMask;
      displacement -= caveIn * p2;
      displacement += slowDrift;
      displacement -= mouthDisp; // Pull inwards for mouth

      // SUBTLE CAMERA/RELATIONAL RESPONSE
      vec3 viewDirVertex = normalize(cameraPosition - (modelMatrix * vec4(basePos, 1.0)).xyz);
      vec3 localViewDir = normalize(mat3(inverse(modelMatrix)) * viewDirVertex);
      float attention = dot(normal, localViewDir) * speakFactor * 0.08;
      displacement += attention;

      vec3 transformed = basePos + normal * displacement;
      `
    );

    shader.fragmentShader = `
      varying vec3 vPos;
      varying float vBreath;
      uniform float uTime;
      uniform float uVolume;
      uniform float uSilence;
      uniform float uSpeak;
      uniform float uEyeL;
      uniform float uEyeR;
      uniform float uBlinkL;
      uniform float uBlinkR;
      uniform float uMouthCurve;
      uniform float uMouthSkew;
      uniform float uMouthOpen;
      uniform vec2 uLookDir;

      ${simplexNoiseGLSL}

      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `
      #include <emissivemap_fragment>

      vec3 viewDir = normalize(vViewPosition);
      float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
      
      // 3 PHASES OF SILENCE
      float p1 = smoothstep(3.0, 4.5, uSilence);
      float p2 = smoothstep(4.5, 7.0, uSilence);
      float p3 = smoothstep(7.0, 12.0, uSilence);
      
      // COLORS (Pastel & Glowing)
      vec3 colStable = vec3(0.1, 0.7, 1.0); // Cyan/Blue
      vec3 colUnstable = vec3(0.7, 0.3, 0.9); // Purple
      vec3 colCritical = vec3(0.4, 0.4, 0.4); // Greyish with red hints
      
      vec3 baseColor = mix(colStable, colUnstable, p1);
      baseColor = mix(baseColor, colCritical, p2);
      
      // --- INTERNAL VEIN SYSTEM (Tension & Blood Flow) ---
      // 1. Create sharp, branching vein structures using absolute noise
      float n1 = 1.0 - abs(snoise(vPos * 2.5));
      float n2 = 1.0 - abs(snoise(vPos * 5.0 - vec3(0.0, uTime * 0.1, 0.0)));
      float veinStructure = pow(n1 * n2, 3.0) * 5.0; // Sharp ridges
      
      // 2. Create the pumping flow along the Y axis, distorted by noise
      float pumpSpeed = 2.0 + uVolume * 15.0; // Massive speedup when speaking (Tension)
      float flowPath = vPos.y * 10.0 + snoise(vPos * 2.0) * 4.0;
      
      // Phase 2: Flow reversal & Chaos
      float flowDirSign = mix(1.0, -1.0, p2);
      float chaos = snoise(vPos * 3.0 + uTime * 2.0) * p2 * 3.0;
      float flowTime = uTime * pumpSpeed * flowDirSign + chaos;
      
      // Phase 3: Loop/stuck
      flowTime = mix(flowTime, sin(uTime * 2.0) * 2.0, p3);
      
      float pump = sin(flowPath - flowTime) * 0.5 + 0.5;
      pump = pow(pump, 4.0); // Concentrated pulses of energy/blood
      
      // 3. Audio Tension (bulging/glowing when loud)
      float tension = uVolume * 5.0;
      
      // Final vein intensity
      float veinIntensity = veinStructure * (pump + tension + 0.1);

      // CENTRAL "CORE PULSE"
      float distToCenter = length(vPos);
      float coreMask = 1.0 - smoothstep(0.0, 0.6, distToCenter);
      
      float corePulse = uVolume * 2.0 + vBreath * 5.0;
      float weakPulse = snoise(vec3(uTime * 2.0)) * 0.2 + 0.1;
      float activePulse = mix(corePulse, weakPulse, p2);
      
      vec3 coreEmission = baseColor * coreMask * activePulse * 2.0;

      // --- PIXAR-STYLE ORGANIC FACE ---
      vec2 faceUV = normalize(vPos).xy;
      float frontMask = smoothstep(0.4, 0.8, normalize(vPos).z);
      
      // Shared State Colors
      vec3 stateGlowStable = vec3(0.2, 0.8, 1.0);
      vec3 stateGlowCritical = vec3(0.9, 0.1, 0.4);
      vec3 stateGlow = mix(stateGlowStable, stateGlowCritical, p2);
      
      // 1. Liquid Eyes (Socket, Pupil, Highlight)
      vec2 socketCenterL = vec2(-0.25, 0.15);
      vec2 socketCenterR = vec2(0.25, 0.15);
      
      // Bounded Pupil Offset (moves with camera, stays inside socket)
      vec2 pupilOffset = clamp(uLookDir * 2.5, vec2(-0.035), vec2(0.035));
      vec2 pupilCenterL = socketCenterL + pupilOffset;
      vec2 pupilCenterR = socketCenterR + pupilOffset;
      
      // UVs for Socket (squished for blink)
      vec2 uvSocketL = faceUV - socketCenterL; uvSocketL.y /= max(uBlinkL, 0.05);
      vec2 uvSocketR = faceUV - socketCenterR; uvSocketR.y /= max(uBlinkR, 0.05);
      
      // UVs for Pupil (squished for blink)
      vec2 uvPupilL = faceUV - pupilCenterL; uvPupilL.y /= max(uBlinkL, 0.05);
      vec2 uvPupilR = faceUV - pupilCenterR; uvPupilR.y /= max(uBlinkR, 0.05);
      
      float dSocketL = length(uvSocketL);
      float dSocketR = length(uvSocketR);
      float dPupilL = length(uvPupilL);
      float dPupilR = length(uvPupilR);
      
      // Micro noise flow for liquid feel
      float eyeNoise = snoise(vPos * 15.0 - vec3(0.0, uTime * 2.0, 0.0)) * 0.005;
      
      // Socket Masks
      float socketL = smoothstep(0.08 * uEyeL, 0.06 * uEyeL, dSocketL + eyeNoise);
      float socketR = smoothstep(0.08 * uEyeR, 0.06 * uEyeR, dSocketR + eyeNoise);
      float socketMask = max(socketL, socketR);
      
      // Halo Masks
      float haloL = smoothstep(0.12 * uEyeL, 0.02 * uEyeL, dSocketL);
      float haloR = smoothstep(0.12 * uEyeR, 0.02 * uEyeR, dSocketR);
      float haloMask = max(haloL, haloR);
      
      // Pupil Masks
      float pupilL = smoothstep(0.045 * uEyeL, 0.035 * uEyeL, dPupilL);
      float pupilR = smoothstep(0.045 * uEyeR, 0.035 * uEyeR, dPupilR);
      float pupilMask = max(pupilL, pupilR);
      
      // Highlight Masks
      vec2 hlOffset = vec2(0.015, 0.015);
      float hlL = smoothstep(0.02 * uEyeL, 0.01 * uEyeL, length(uvPupilL - hlOffset));
      float hlR = smoothstep(0.02 * uEyeR, 0.01 * uEyeR, length(uvPupilR - hlOffset));
      float hlMask = max(hlL, hlR);
      
      float eyeMask = clamp(socketMask + haloMask * 0.5, 0.0, 1.0);
      
      // Eye Color Assembly
      vec3 eyeBaseColor = stateGlow * 1.2; // Bright outer eye
      vec3 eyeDarkColor = stateGlow * 0.1; // Dark pupil
      
      vec3 eyeColor = eyeBaseColor;
      eyeColor = mix(eyeColor, eyeDarkColor, pupilMask);
      eyeColor = mix(eyeColor, vec3(1.0), hlMask); // White highlight
      
      // 2. Soft Tissue Mouth
      vec2 mouthCenter = vec2(0.0, -0.1);
      vec2 mUV = faceUV - mouthCenter;
      
      // Skew & Curve (Squash/Stretch)
      mUV.y += mUV.x * uMouthSkew;
      mUV.y -= mUV.x * mUV.x * uMouthCurve * 3.0; 
      
      // Dynamic opening
      float mouthWidth = 0.12;
      float mouthHeight = 0.015 + uMouthOpen * 0.08;
      
      // Distance field for mouth
      float dMouth = length(vec2(mUV.x / mouthWidth, mUV.y / mouthHeight));
      
      float mouthCore = smoothstep(1.0, 0.6, dMouth);
      float mouthHalo = smoothstep(1.5, 0.8, dMouth) * 0.6;
      
      float mouthMask = clamp(mouthCore + mouthHalo, 0.0, 1.0);
      
      // Mouth Colors (Dark inside, glowing edges matching body state)
      vec3 mouthInside = mix(vec3(0.0, 0.05, 0.15), vec3(0.1, 0.0, 0.05), p2);
      vec3 finalMouthColor = mix(stateGlow, mouthInside, smoothstep(0.5, 1.0, mouthCore));
      
      // 3. Integration (Mask inside shader)
      float faceMask = clamp(eyeMask + mouthMask, 0.0, 1.0) * frontMask;
      
      // Organic perturbation so it feels embedded in the flesh
      faceMask *= 1.0 - snoise(vPos * 10.0 + uTime) * 0.15;
      
      // Mix face features
      vec3 faceColor = mix(finalMouthColor, eyeColor, eyeMask / (eyeMask + mouthMask + 0.0001));
      
      // Blend into body's diffuse color
      diffuseColor.rgb = mix(diffuseColor.rgb, faceColor, faceMask);
      
      // Face emission (glows slightly)
      vec3 faceEmission = faceColor * faceMask * 1.5;

      // NECROSIS (Phase 2+)
      float necrosisMask = smoothstep(0.3, 0.8, snoise(vPos * 1.5 + uTime * 0.1));
      float necrosis = necrosisMask * p2;

      // Combine emission
      vec3 bodyEmission = (baseColor * veinIntensity * (vBreath * 2.0 + 0.5) + coreEmission) * pow(fresnel, 1.5);
      bodyEmission *= (1.0 - necrosis * 0.8);
      
      // Add face emission
      vec3 finalEmission = bodyEmission + faceEmission;
      
      // Edge glow
      vec3 edgeGlow = mix(baseColor * 0.8, vec3(0.2, 0.0, 0.0), p2);
      finalEmission += edgeGlow * pow(fresnel, 3.0) * (1.0 - necrosis);

      totalEmissiveRadiance += finalEmission;
      `
    );
  };

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 128]} />
      <meshPhysicalMaterial
        ref={materialRef}
        color="#ffffff"
        emissive="#000000"
        roughness={0.4}
        metalness={0.0}
        transmission={0.9}
        thickness={2.0}
        ior={1.2}
        clearcoat={0.0}
        clearcoatRoughness={0.0}
        attenuationColor="#ffb1e8"
        attenuationDistance={3.0}
        transparent={true}
        onBeforeCompile={onBeforeCompile}
      />
    </mesh>
  );
}

