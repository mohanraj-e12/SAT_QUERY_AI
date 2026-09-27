import React, { useState } from 'react';
import { SpectralStatistics } from '../types/index.js';
import { Info, BarChart2, CheckCircle, Database } from 'lucide-react';

interface SpectralChartProps {
  statistics?: SpectralStatistics;
  indexName?: string;
  formula?: string;
}

export const SpectralChart: React.FC<SpectralChartProps> = ({
  statistics,
  indexName = 'NDVI',
  formula = 'Normalized Difference Index',
}) => {
  const [showDebug, setShowDebug] = useState(false);

  if (!statistics) {
    return (
      <div className="p-4 rounded-xl border border-[#eeddd3] bg-white text-center text-xs text-slate-500 font-mono">
        No spectral statistics available for this acquisition.
      </div>
    );
  }

  const items = [
    {
      label: 'Vegetation Canopy',
      pct: statistics.vegetationPercentage ?? 0,
      available: statistics.classAvailability?.vegetation !== false,
      pixels: statistics.vegetationPixelCount ?? statistics.debugInfo?.vegetationPixels,
      color: 'bg-emerald-500',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Built-up / Impervious',
      pct: statistics.builtUpPercentage ?? 0,
      available: statistics.classAvailability?.built_up !== false,
      pixels: statistics.builtUpPixelCount ?? statistics.debugInfo?.builtUpPixels,
      color: 'bg-[#FD1843]',
      text: 'text-[#FD1843]',
      border: 'border-[#FD1843]/30',
      bg: 'bg-[#FD1843]/10',
    },
    {
      label: 'Water Bodies',
      pct: statistics.waterPercentage ?? 0,
      available: statistics.classAvailability?.water !== false,
      pixels: statistics.waterPixelCount ?? statistics.debugInfo?.waterPixels,
      color: 'bg-sky-500',
      text: 'text-sky-700',
      border: 'border-sky-200',
      bg: 'bg-sky-50',
    },
    {
      label: 'Bare Soil / Fallow',
      pct: statistics.bareSoilPercentage ?? 0,
      available: statistics.classAvailability?.bare_land !== false,
      pixels: statistics.bareSoilPixelCount ?? statistics.debugInfo?.bareSoilPixels,
      color: 'bg-amber-500',
      text: 'text-amber-700',
      border: 'border-amber-200',
      bg: 'bg-amber-50',
    },
  ];

  const totalValid = statistics.validPixelCount ?? statistics.debugInfo?.totalValidPixels ?? statistics.totalPixels;

  return (
    <div className="rounded-xl border border-[#eeddd3] bg-white p-4 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#eeddd3] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#FD1843]">
              {indexName} Metrics
            </span>
            {statistics.method && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FD1843]/10 text-[#FD1843] border border-[#FD1843]/20 font-semibold">
                {statistics.isMultispectral ? 'Multi-Spectral (NIR/SWIR)' : 'RGB Heuristic Estimate'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">{formula}</p>
        </div>
        {statistics.meanIndex !== undefined && (
          <div className="text-right">
            <span className="text-[10px] uppercase text-slate-500 font-mono">
              {statistics.isMultispectral ? 'Mean Index' : 'Mean RGB Proxy'}
            </span>
            <p className="text-sm font-mono font-bold text-slate-900">
              {statistics.meanIndex > 0 ? `+${statistics.meanIndex.toFixed(3)}` : statistics.meanIndex.toFixed(3)}
            </p>
          </div>
        )}
      </div>

      {/* Segmented Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-[#FFF9F4] p-0.5 border border-[#eeddd3]">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`${item.color} h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${item.available ? Math.max(0, item.pct) : 0}%` }}
              title={`${item.label}: ${item.available ? `${item.pct}%` : 'Unavailable'}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
          {items.map((item, idx) => (
            <div key={idx} className={`rounded-lg ${item.bg} p-2.5 border ${item.border}`}>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
                <span className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="truncate font-medium">{item.label}</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <p className={`font-mono text-base font-bold ${item.text}`}>
                  {item.available ? `${item.pct}%` : 'Unavailable'}
                </p>
                {item.available && item.pixels !== undefined && (
                  <span className="text-[10px] font-mono text-slate-500">
                    {item.pixels.toLocaleString()} px
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Valid Pixel Count & Details */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#eeddd3] text-[11px] font-mono text-slate-500">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>Analyzed Valid Pixels:</span>
          <span className="text-slate-900 font-semibold">
            {totalValid ? totalValid.toLocaleString() : 'Unavailable'} px
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowDebug(!showDebug)}
          className="text-xs text-[#FD1843] hover:text-[#e01239] underline underline-offset-2 flex items-center gap-1 font-semibold"
        >
          <Database className="w-3 h-3" />
          <span>{showDebug ? 'Hide Pixel Breakdown' : 'Show Pixel Counts'}</span>
        </button>
      </div>

      {/* Debug Pixel Counts Inspection Drawer */}
      {showDebug && (
        <div className="rounded-lg bg-[#FFF9F4] p-3 border border-[#eeddd3] space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between text-slate-500 pb-1.5 border-b border-[#eeddd3]">
            <span>Pixel Category</span>
            <span>Count / Share</span>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-slate-700">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${item.color}`} />
                {item.label}:
              </span>
              <span className="text-slate-900 font-semibold">
                {item.available
                  ? `${item.pixels !== undefined ? item.pixels.toLocaleString() : 'Unavailable'} px (${item.pct}%)`
                  : 'Unavailable'}
              </span>
            </div>
          ))}
          {statistics.excludedPixelCount !== undefined && statistics.excludedPixelCount > 0 && (
            <div className="flex justify-between items-center text-slate-500 pt-1 border-t border-[#eeddd3]">
              <span>Cloud/NoData (Excluded):</span>
              <span>{statistics.excludedPixelCount.toLocaleString()} px</span>
            </div>
          )}
          {statistics.totalAreaHa && (
            <div className="flex justify-between items-center text-[#FD1843] font-semibold pt-1 border-t border-[#eeddd3]">
              <span>Total Area (Ha):</span>
              <span>{statistics.totalAreaHa.toLocaleString()} ha</span>
            </div>
          )}
        </div>
      )}

      {/* Histogram */}
      {statistics.histogram && statistics.histogram.length > 0 && (
        <div className="pt-2 border-t border-[#eeddd3]">
          <p className="text-[11px] font-mono text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-[#FD1843]" />
            Density Distribution Histogram
          </p>
          <div className="space-y-1.5">
            {statistics.histogram.map((bin, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="w-36 truncate text-slate-600 font-mono text-[11px]">{bin.range}</span>
                <div className="flex-1 h-2 bg-[#eeddd3]/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FD1843] rounded-full transition-all duration-300"
                    style={{ width: `${bin.percentage}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-[11px] text-slate-700">
                  {bin.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
