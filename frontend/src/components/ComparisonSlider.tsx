import React, { useState } from 'react';
import { SatelliteImage } from '../types/index.js';

interface ComparisonSliderProps {
  beforeImage: SatelliteImage;
  afterImage: SatelliteImage;
  className?: string;
  height?: string;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  beforeImage,
  afterImage,
  className = '',
  height = '420px',
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(50);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPosition(Number(e.target.value));
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-[#eeddd3] bg-white select-none ${className}`}
      style={{ height }}
    >
      {/* After Image (Background / Full Width) */}
      <img
        src={afterImage.file_url}
        alt={`After: ${afterImage.file_name}`}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      <div className="absolute top-3 right-3 z-10 rounded-md bg-white/90 px-2.5 py-1 text-xs font-mono font-medium text-emerald-700 border border-emerald-500/30 backdrop-blur-md shadow-xs">
        AFTER: {afterImage.acquisition_date} ({afterImage.satellite})
      </div>

      {/* Before Image (Clipped by slider position) */}
      <div
        className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none border-r-2 border-[#FD1843] shadow-2xl"
        style={{ width: `${sliderPosition}%` }}
      >
        <img
          src={beforeImage.file_url}
          alt={`Before: ${beforeImage.file_name}`}
          className="absolute inset-0 w-full h-full object-cover max-w-none pointer-events-none"
          style={{ width: '100%', height: '100%', minWidth: '100%' }}
        />
        <div className="absolute top-3 left-3 z-10 rounded-md bg-white/90 px-2.5 py-1 text-xs font-mono font-medium text-[#FD1843] border border-[#FD1843]/30 backdrop-blur-md shadow-xs">
          BEFORE: {beforeImage.acquisition_date} ({beforeImage.satellite})
        </div>
      </div>

      {/* Center Divider Line & Handle */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none z-20 flex items-center justify-center -ml-4"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="w-8 h-8 rounded-full bg-[#FD1843] text-white flex items-center justify-center shadow-lg border-2 border-white font-bold text-xs">
          ↔
        </div>
      </div>

      {/* Transparent HTML Range Input for Dragging */}
      <input
        type="range"
        min={0}
        max={100}
        value={sliderPosition}
        onChange={handleSliderChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30 m-0"
        aria-label="Swipe comparison slider"
      />

      {/* Bottom Hint */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 rounded-full bg-white/90 px-3 py-0.5 text-[11px] font-mono text-slate-600 backdrop-blur-md pointer-events-none border border-[#eeddd3] shadow-xs">
        Drag slider horizontally to inspect surface change
      </div>
    </div>
  );
};
