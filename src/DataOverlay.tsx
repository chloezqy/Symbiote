import React, { useEffect, useRef, useState } from 'react';
import { AudioAnalyzer } from './AudioAnalyzer';

export function DataOverlay({ analyzer }: { analyzer: AudioAnalyzer }) {
  const [uiData, setUiData] = useState({
    volume: 0,
    stability: 1,
    tension: 0,
    pitchJitter: 0,
    state: 'AWAITING'
  });

  const [displayData, setDisplayData] = useState({
    volume: 0,
    stability: 1,
    tension: 0,
    pitchJitter: 0
  });

  const volBarRef = useRef<HTMLDivElement>(null);
  const stabBarRef = useRef<HTMLDivElement>(null);
  const tensionBarRef = useRef<HTMLDivElement>(null);
  const pitchBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frameId: number;
    const update = () => {
      if (analyzer.isInitialized) {
        const newData = {
          volume: analyzer.uiVolume,
          stability: analyzer.uiStability,
          tension: analyzer.uiTension,
          pitchJitter: analyzer.uiPitchJitter,
          state: analyzer.uiState
        };
        setUiData(newData);

        // Display data with amplified volume for better visualization
        const newDisplayData = {
          volume: Math.sqrt(newData.volume), // Amplified for display
          stability: newData.stability,
          tension: newData.tension,
          pitchJitter: newData.pitchJitter
        };
        setDisplayData(newDisplayData);

        // Update progress bars
        if (volBarRef.current) {
          volBarRef.current.style.width = `${Math.min(100, newDisplayData.volume * 100)}%`;
          volBarRef.current.style.backgroundColor = `rgba(59, 130, 246, ${0.3 + newData.volume * 0.7})`;
        }
        if (stabBarRef.current) {
          stabBarRef.current.style.width = `${newData.stability * 100}%`;
          stabBarRef.current.style.backgroundColor = newData.stability > 0.7 ? 'rgba(34, 197, 94, 0.8)' : newData.stability > 0.4 ? 'rgba(251, 191, 36, 0.8)' : 'rgba(239, 68, 68, 0.8)';
        }
        if (tensionBarRef.current) {
          tensionBarRef.current.style.width = `${newData.tension * 100}%`;
          tensionBarRef.current.style.backgroundColor = `rgba(168, 85, 247, ${0.3 + newData.tension * 0.7})`;
        }
        if (pitchBarRef.current) {
          pitchBarRef.current.style.width = `${Math.min(100, newData.pitchJitter * 200)}%`;
          pitchBarRef.current.style.backgroundColor = `rgba(236, 72, 153, ${0.3 + newData.pitchJitter * 0.7})`;
        }
      }
      frameId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frameId);
  }, [analyzer]);

  return (
    <div 
      className="absolute bottom-6 right-8 font-mono text-sm tracking-wider text-blue-200 flex flex-col gap-3 pointer-events-none z-50"
      style={{ 
        background: 'rgba(0, 0, 0, 0.8)', 
        border: '1px solid rgba(59, 130, 246, 0.3)', 
        borderRadius: '12px', 
        padding: '16px',
        boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)',
        backdropFilter: 'blur(10px)',
        minWidth: '280px'
      }}
    >
      <div className="text-blue-100 font-bold border-b border-blue-500/30 pb-2 mb-2 text-center">AUDIO METRICS</div>
      
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs">Volume:</span> 
          <span className="text-xs font-bold">{displayData.volume.toFixed(3)}</span>
        </div>
        <div className="w-40 h-3 bg-gray-700 rounded-full overflow-hidden">
          <div ref={volBarRef} className="h-full transition-all duration-300 rounded-full"></div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs">Stability:</span> 
          <span className="text-xs font-bold">{uiData.stability.toFixed(3)}</span>
        </div>
        <div className="w-40 h-3 bg-gray-700 rounded-full overflow-hidden">
          <div ref={stabBarRef} className="h-full transition-all duration-300 rounded-full"></div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs">Tension:</span> 
          <span className="text-xs font-bold">{uiData.tension.toFixed(3)}</span>
        </div>
        <div className="w-40 h-3 bg-gray-700 rounded-full overflow-hidden">
          <div ref={tensionBarRef} className="h-full transition-all duration-300 rounded-full"></div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs">Pitch Jitter:</span> 
          <span className="text-xs font-bold">{uiData.pitchJitter.toFixed(3)}</span>
        </div>
        <div className="w-40 h-3 bg-gray-700 rounded-full overflow-hidden">
          <div ref={pitchBarRef} className="h-full transition-all duration-300 rounded-full"></div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-blue-500/30">
        <span className="text-xs font-bold">STATE:</span> 
        <span 
          className="text-sm font-bold uppercase tracking-wider"
          style={{
            color: uiData.state === 'CRITICAL' ? '#ef4444' : 
                   uiData.state === 'DEGRADING' ? '#f59e0b' : 
                   '#10b981',
            textShadow: uiData.state === 'CRITICAL' ? '0 0 8px #ef4444' : 
                       uiData.state === 'DEGRADING' ? '0 0 8px #f59e0b' : 
                       '0 0 8px #10b981'
          }}
        >
          {uiData.state}
        </span>
      </div>
    </div>
  );
}
