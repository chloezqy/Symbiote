/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { AudioAnalyzer } from './AudioAnalyzer';
import { Organ } from './Organ';
import { DataOverlay } from './DataOverlay';

export default function App() {
  const [started, setStarted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const analyzerRef = useRef<AudioAnalyzer>(new AudioAnalyzer());

  const handleStart = async () => {
    await analyzerRef.current.init();
    setStarted(true);
  };

  return (
    <div className="w-full h-screen bg-[#010102] text-white overflow-hidden relative font-sans">
      {!started && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#010102]">
          <style>{`
            @keyframes breathe {
              0%, 100% { transform: scale(1); opacity: 0.5; }
              50% { transform: scale(1.05); opacity: 1; }
            }
          `}</style>
          
          {/* Hover Scale & Opacity Wrapper */}
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-1000 ease-out"
            style={{ 
              transform: isHovered ? 'scale(1.1)' : 'scale(1)',
              opacity: isHovered ? 0.15 : 0.08
            }}
          >
            {/* Breathing Blob */}
            <div 
              className="w-[30rem] h-[30rem] md:w-[40rem] md:h-[40rem] bg-indigo-500 rounded-full blur-[100px]"
              style={{ animation: 'breathe 6s infinite ease-in-out' }}
            />
          </div>

          <div className="z-20 flex flex-col items-center">
            <h1 className="text-5xl md:text-6xl font-light tracking-[0.4em] mb-12 text-blue-100/90 drop-shadow-lg">
              SYMBIOTE
            </h1>
            
            <div className="flex flex-col items-center gap-3 mb-16 text-blue-200/60 font-light tracking-widest text-sm">
              <p>Not a system.</p>
              <p>A living creature.</p>
              <p className="mt-6 text-blue-300/40 text-xs tracking-[0.2em]">Your voice shapes its nervous system.</p>
            </div>

            <button 
              onClick={handleStart}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className={`px-12 py-4 border transition-all duration-700 tracking-[0.3em] text-sm uppercase backdrop-blur-sm cursor-pointer ${
                isHovered 
                  ? 'border-blue-400/80 text-blue-100 bg-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.4)]' 
                  : 'border-blue-500/30 text-blue-300/70 hover:bg-blue-500/10'
              }`}
            >
              Awaken
            </button>
          </div>
        </div>
      )}

      {started && <DataOverlay analyzer={analyzerRef.current} />}

      <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
        <color attach="background" args={['#010102']} />
        <fog attach="fog" args={['#010102', 3, 10]} />
        
        <ambientLight intensity={0.05} />
        <directionalLight position={[2, 5, 2]} intensity={0.8} color="#4a6fa5" />
        <directionalLight position={[-2, -5, -2]} intensity={0.2} color="#2a1b38" />
        <pointLight position={[0, 0, 0]} intensity={0.5} color="#8a4fff" distance={5} />

        <Organ analyzer={analyzerRef.current} />

        <OrbitControls 
          enablePan={false} 
          enableZoom={false} 
          minPolarAngle={Math.PI / 3} 
          maxPolarAngle={Math.PI / 1.5}
          autoRotate
          autoRotateSpeed={0.2}
        />
      </Canvas>
    </div>
  );
}
