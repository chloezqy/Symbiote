import React, { useEffect, useRef } from 'react';
import { AudioAnalyzer } from './AudioAnalyzer';

export function DataOverlay({ analyzer }: { analyzer: AudioAnalyzer }) {
  const volRef = useRef<HTMLSpanElement>(null);
  const stabRef = useRef<HTMLSpanElement>(null);
  const tensionRef = useRef<HTMLSpanElement>(null);
  const stateRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frameId: number;
    const update = () => {
      if (analyzer.isInitialized) {
        if (volRef.current) volRef.current.innerText = analyzer.uiVolume.toFixed(3);
        if (stabRef.current) stabRef.current.innerText = analyzer.uiStability.toFixed(3);
        if (tensionRef.current) tensionRef.current.innerText = analyzer.uiTension.toFixed(3);
        if (stateRef.current) {
            stateRef.current.innerText = analyzer.uiState;
            stateRef.current.style.color = 
              analyzer.uiState === 'CRITICAL' ? '#ff4444' : 
              analyzer.uiState === 'DEGRADING' ? '#ffaa00' : 
              '#44aaff';
        }
      }
      frameId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frameId);
  }, [analyzer]);

  return (
    <div 
      className="absolute bottom-6 right-8 font-mono text-[10px] tracking-widest text-blue-300/50 flex flex-col gap-1 pointer-events-none z-50 mix-blend-screen" 
      style={{ textShadow: '0 0 4px rgba(100,150,255,0.3)', animation: 'flicker 4s infinite alternate' }}
    >
      <style>{`
        @keyframes flicker {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.4; }
          25%, 75% { opacity: 0.6; }
        }
      `}</style>
      <div className="mb-2 text-blue-200/70 border-b border-blue-500/20 pb-1">SIGNAL DATA</div>
      <div className="flex justify-between gap-8"><span>Volume:</span> <span ref={volRef}>0.000</span></div>
      <div className="flex justify-between gap-8"><span>Stability:</span> <span ref={stabRef}>0.000</span></div>
      <div className="flex justify-between gap-8"><span>Tension:</span> <span ref={tensionRef}>0.000</span></div>
      <div className="flex justify-between gap-8 mt-1"><span>STATE:</span> <span ref={stateRef}>AWAITING</span></div>
    </div>
  );
}
