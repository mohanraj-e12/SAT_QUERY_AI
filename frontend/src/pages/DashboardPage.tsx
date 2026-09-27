import React from 'react';
import {
  Satellite,
  Compass,
  Bot,
  Layers,
  PieChart,
  Target,
  Flame,
  Sprout,
  Building2,
  Droplets,
  TrendingUp,
  ArrowRight,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { Project, SatelliteImage, AnalysisSession, Alert } from '../types/index.js';
import { StatCard } from '../components/StatCard.js';
import { ConfidenceBadge } from '../components/ConfidenceBadge.js';
import { NavigationTab } from '../components/Sidebar.js';

interface DashboardPageProps {
  projects: Project[];
  images: SatelliteImage[];
  sessions: AnalysisSession[];
  alerts: Alert[];
  onNavigate: (tab: NavigationTab) => void;
  onSelectImageForAssistant: (image: SatelliteImage) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  projects,
  images,
  sessions,
  alerts,
  onNavigate,
  onSelectImageForAssistant,
}) => {
  const latestSession = sessions[0];
  const primaryImage = images[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[#eeddd3] bg-gradient-to-r from-white via-[#FFF9F4] to-[#ffe5ea] p-6 md:p-8 shadow-xs">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FD1843]/30 bg-[#FD1843]/10 px-3 py-1 text-xs font-mono text-[#FD1843] font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Powered Satellite Image Analysis Software</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-slate-900">
            SatQueryAI • Mission Overview & Analysis Hub
          </h1>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed max-w-2xl">
            Query multispectral satellite imagery using natural language. Execute scientific NDVI, NDWI, and NDBI calculations, zero-shot land-cover classification, object detection with SAM, and bi-temporal change detection.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('assistant')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FD1843] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#FD1843]/20 hover:bg-[#e01239] transition-all"
            >
              <Bot className="w-4 h-4" />
              <span>Launch AI Vision Assistant</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="inline-flex items-center gap-2 rounded-xl border border-[#eeddd3] bg-white px-4 py-2.5 text-xs font-medium text-slate-800 hover:bg-[#FFF9F4] transition-all shadow-xs"
            >
              <Compass className="w-4 h-4 text-[#FD1843]" />
              <span>Open Geospatial Map</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('change-detection')}
              className="inline-flex items-center gap-2 rounded-xl border border-[#eeddd3] bg-white px-4 py-2.5 text-xs font-medium text-slate-800 hover:bg-[#FFF9F4] transition-all shadow-xs"
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Bi-Temporal Change</span>
            </button>
          </div>
        </div>

        {/* Decorative Grid / Satellite Icon */}
        <div className="absolute right-4 bottom-4 opacity-10 pointer-events-none md:opacity-20">
          <Satellite className="w-64 h-64 text-[#FD1843]" />
        </div>
      </div>

      {/* KPI Stats Row: Active Software Analysis Modules */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Land Cover Classification"
          value="CLC-19"
          subtitle="GeoRSCLIP Multi-Class"
          icon={PieChart}
          iconColor="text-[#FD1843]"
          onClick={() => onNavigate('land-cover')}
        />
        <StatCard
          title="Object Detection"
          value="SAM-DL"
          subtitle="Zero-Shot Grounding"
          icon={Target}
          iconColor="text-amber-500"
          onClick={() => onNavigate('object-detection')}
        />
        <StatCard
          title="Water & Vegetation"
          value="NDVI/NDWI"
          subtitle="Calculated Radiometric Values"
          icon={Droplets}
          iconColor="text-emerald-500"
          onClick={() => onNavigate('water-vegetation')}
        />
        <StatCard
          title="Urban Growth"
          value="NDBI"
          subtitle="Bi-Temporal Expansion"
          icon={Building2}
          iconColor="text-[#FD1843]"
          onClick={() => onNavigate('urban-growth')}
        />
      </div>

      {/* Main Grid: Latest Analysis Session & Quick Launch Scenes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Latest Analysis Session */}
        <div className="rounded-xl border border-[#eeddd3] bg-white p-6 lg:col-span-2 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#eeddd3] pb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#FD1843]" />
              <h2 className="text-sm font-semibold font-mono text-slate-900">
                Latest Earth Observation Analysis
              </h2>
            </div>
            {latestSession && (
              <ConfidenceBadge confidence={latestSession.confidence} />
            )}
          </div>

          {latestSession ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg bg-[#FFF9F4] p-4 border border-[#eeddd3]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#FD1843] font-semibold">
                  User Natural-Language Query
                </span>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  "{latestSession.query}"
                </p>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Multimodal Interpretation
                </span>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                  {latestSession.result.summary}
                </p>
              </div>

              {/* Spectral Statistics Pill Row */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-2">
                {latestSession.result.statistics?.vegetationPercentage !== undefined && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5">
                    <span className="text-[10px] text-emerald-700 font-mono font-medium">Vegetation</span>
                    <p className="text-base font-mono font-bold text-emerald-800">
                      {latestSession.result.statistics.vegetationPercentage}%
                    </p>
                  </div>
                )}
                {latestSession.result.statistics?.waterPercentage !== undefined && (
                  <div className="rounded-lg bg-[#FD1843]/10 border border-[#FD1843]/20 p-2.5">
                    <span className="text-[10px] text-[#FD1843] font-mono font-medium">Water Cover</span>
                    <p className="text-base font-mono font-bold text-[#FD1843]">
                      {latestSession.result.statistics.waterPercentage}%
                    </p>
                  </div>
                )}
                {latestSession.result.statistics?.builtUpPercentage !== undefined && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5">
                    <span className="text-[10px] text-rose-700 font-mono font-medium">Built-up Area</span>
                    <p className="text-base font-mono font-bold text-rose-800">
                      {latestSession.result.statistics.builtUpPercentage}%
                    </p>
                  </div>
                )}
                {latestSession.result.statistics?.meanIndex !== undefined && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                    <span className="text-[10px] text-amber-700 font-mono font-medium">Mean Index</span>
                    <p className="text-base font-mono font-bold text-amber-800">
                      +{latestSession.result.statistics.meanIndex.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('assistant')}
                  className="flex items-center gap-1.5 text-xs font-mono text-[#FD1843] hover:text-[#e01239] font-semibold"
                >
                  <span>Open in AI Assistant</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-8 text-center text-xs text-slate-500 font-mono">
              No analysis sessions recorded yet. Launch the assistant to inspect your first satellite image!
            </div>
          )}
        </div>

        {/* Right 1 Col: Quick Launch Satellite Scenes */}
        <div className="rounded-xl border border-[#eeddd3] bg-white p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#eeddd3] pb-4">
            <h2 className="text-sm font-semibold font-mono text-slate-900">
              Catalog Scenes ({images.length})
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="text-xs font-mono text-[#FD1843] hover:underline font-semibold"
            >
              View in Map
            </button>
          </div>

          {images.length > 0 ? (
            <div className="space-y-3">
              {images.slice(0, 3).map((img) => (
                <div
                  key={img.id}
                  className="group flex items-center gap-3 rounded-xl border border-[#eeddd3] bg-[#FFF9F4] p-2.5 transition-colors hover:border-[#FD1843]/50"
                >
                  <img
                    src={img.file_url}
                    alt={img.file_name}
                    className="h-14 w-14 rounded-lg object-cover border border-[#eeddd3] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-semibold text-slate-900 truncate group-hover:text-[#FD1843] transition-colors">
                      {img.file_name}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {img.satellite} • {img.acquisition_date}
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-mono text-slate-400">
                      Res: {img.resolution_meters != null ? `${img.resolution_meters}m` : 'Unavailable'} • Cloud: {img.cloud_percentage != null ? `${img.cloud_percentage}%` : 'Unavailable'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectImageForAssistant(img)}
                    className="rounded-lg p-2 bg-white border border-[#eeddd3] text-[#FD1843] hover:bg-[#FD1843] hover:text-white transition-colors shadow-xs"
                    title="Analyze with AI Assistant"
                  >
                    <Bot className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#eeddd3] p-6 text-center">
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-mono text-slate-600">No satellite scenes cataloged yet.</p>
              <p className="text-[11px] text-slate-500 mt-1">Upload an image to start visual Q&A.</p>
              <button
                type="button"
                onClick={() => onNavigate('assistant')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#FD1843] px-3 py-1.5 text-xs font-mono text-white hover:bg-[#e01239] transition-colors shadow-xs"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Go to Assistant</span>
              </button>
            </div>
          )}

          {/* Quick Change Detection Callout */}
          {images.length >= 2 && (
            <div className="rounded-xl border border-[#FD1843]/20 bg-[#FD1843]/5 p-4">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#FD1843]">
                <Layers className="w-4 h-4" />
                <span>Multi-Temporal Comparison Ready</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">
                {images[0].satellite} ({images[0].acquisition_date}) vs {images[1].satellite} ({images[1].acquisition_date})
              </p>
              <button
                type="button"
                onClick={() => onNavigate('change-detection')}
                className="mt-3 block w-full rounded-lg bg-white border border-[#FD1843]/30 py-2 text-center text-xs font-medium text-[#FD1843] hover:bg-[#FD1843] hover:text-white font-mono transition-colors shadow-xs"
              >
                Compare Multi-Date acquisitions →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
