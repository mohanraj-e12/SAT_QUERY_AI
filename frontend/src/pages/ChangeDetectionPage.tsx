import React, { useState } from 'react';
import {
  Layers,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  FileImage,
  ArrowRight,
  ShieldCheck,
  Sprout,
  Droplets,
  Building2,
  Activity,
  CheckCircle2,
  AlertOctagon,
} from 'lucide-react';
import { SatelliteImage, Project, ChangeDetectionResult } from '../types/index.js';
import { ComparisonSlider } from '../components/ComparisonSlider.js';
import { ConfidenceBadge } from '../components/ConfidenceBadge.js';
import { analysisService } from '../services/analysis.service.js';

interface ChangeDetectionPageProps {
  images: SatelliteImage[];
  activeProject: Project | null;
}

export const ChangeDetectionPage: React.FC<ChangeDetectionPageProps> = ({
  images,
  activeProject,
}) => {
  const [beforeId, setBeforeId] = useState<string>(images[0]?.id || '');
  const [afterId, setAfterId] = useState<string>(images[1]?.id || images[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [changeResult, setChangeResult] = useState<ChangeDetectionResult | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);

  const beforeImg = images.find((i) => i.id === beforeId) || images[0];
  const afterImg = images.find((i) => i.id === afterId) || images[1] || images[0];

  const runAnalysis = async () => {
    if (!beforeImg || !afterImg) return;
    setLoading(true);
    setAnalysisMessage(null);
    setChangeResult(null);

    try {
      const session = await analysisService.analyzeChange({
        imageId: beforeImg.id,
        secondaryImageId: afterImg.id,
        projectId: activeProject?.id,
        query: 'Bi-temporal comparative analysis: detect land improvement, urban expansion, and environmental factors',
        parameters: { selected_module: 'change-detection' },
      });

      setAnalysisMessage(
        session?.result?.directAnswer
        || session?.result?.summary
        || 'The images could not be compared with the available analysis evidence.'
      );
    } catch (error) {
      console.error('[ChangeDetectionPage] Image comparison failed:', error);
      setAnalysisMessage(
        error instanceof Error
          ? `Image comparison failed: ${error.message}`
          : 'Image comparison failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRunChangeDetection = () => {
    runAnalysis();
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'IMPROVED':
      case 'RESTORED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-mono font-bold text-emerald-700 border border-emerald-300">
            <Sprout className="w-3.5 h-3.5" />
            Land Improvement / Recovery
          </span>
        );
      case 'EXPANDED_URBAN':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-mono font-bold text-amber-700 border border-amber-300">
            <Building2 className="w-3.5 h-3.5" />
            Urban / Built-up Expansion
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-mono font-bold text-rose-700 border border-rose-300">
            <AlertOctagon className="w-3.5 h-3.5" />
            Canopy Depletion / Land Stress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FD1843]/10 px-3 py-1 text-xs font-mono font-bold text-[#FD1843] border border-[#FD1843]/30">
            <Activity className="w-3.5 h-3.5" />
            Stable Terrestrial Base
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-[#eeddd3] bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#FD1843]/10 p-2.5 text-[#FD1843] border border-[#FD1843]/30">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 font-mono">
              Bi-Temporal Remote-Sensing Comparison
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare image-derived land-cover estimates; pixel-aligned change requires co-registered imagery.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunChangeDetection}
          disabled={loading || !beforeImg || !afterImg || beforeImg.id === afterImg.id}
          className="flex items-center gap-2 rounded-lg bg-[#FD1843] px-4 py-2 text-xs font-mono font-semibold text-white hover:bg-[#e01239] disabled:opacity-40 transition-all shadow-lg shadow-[#FD1843]/20"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing Changes & Improvements...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Compare Image Coverage</span>
            </>
          )}
        </button>
      </div>

      {images.length < 2 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#eeddd3] bg-white p-12 text-center shadow-xs">
          <Layers className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h2 className="text-base font-mono font-bold text-slate-900 mb-2">
            Multi-Temporal Scenes Required
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
            Bi-temporal change detection compares two distinct satellite scenes (T1 baseline and T2 target date) to compute NDVI loss/gain, land improvement, and transition matrices.
          </p>
          <p className="text-xs text-[#FD1843] font-mono font-semibold">
            {images.length === 1
              ? '1 scene currently loaded. Please upload 1 more scene to enable comparative change detection.'
              : 'No satellite imagery loaded. Please upload at least 2 scenes to get started.'}
          </p>
        </div>
      ) : (
        <>
          {/* Selectors Bar: Before & After */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl border border-[#eeddd3] bg-[#FFF9F4] p-4 shadow-xs">
            {/* Before Scene Selector */}
            <div>
              <label className="block text-xs font-mono text-[#FD1843] mb-1.5 font-semibold">
                T1 (Baseline / Before Acquisition)
              </label>
              <select
                value={beforeId}
                onChange={(e) => {
                  setBeforeId(e.target.value);
                  setChangeResult(null);
                  setAnalysisMessage(null);
                }}
                className="w-full rounded-lg border border-[#eeddd3] bg-white px-3 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none"
              >
                {images.map((img) => (
                  <option key={img.id} value={img.id}>
                    {img.file_name} — {img.acquisition_date} ({img.satellite})
                  </option>
                ))}
              </select>
            </div>

            {/* After Scene Selector */}
            <div>
              <label className="block text-xs font-mono text-emerald-700 mb-1.5 font-semibold">
                T2 (Current / After Acquisition)
              </label>
              <select
                value={afterId}
                onChange={(e) => {
                  setAfterId(e.target.value);
                  setChangeResult(null);
                  setAnalysisMessage(null);
                }}
                className="w-full rounded-lg border border-[#eeddd3] bg-white px-3 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none"
              >
                {images.map((img) => (
                  <option key={img.id} value={img.id}>
                    {img.file_name} — {img.acquisition_date} ({img.satellite})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive Swipe Comparison Slider */}
          {beforeImg && afterImg && (
            <div className="rounded-2xl border border-[#eeddd3] bg-white p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-600">
                  Interactive Surface Swipe Comparator
                </h3>
                {changeResult && <ConfidenceBadge confidence={changeResult.confidence} />}
              </div>

              <ComparisonSlider
                beforeImage={beforeImg}
                afterImage={afterImg}
                height="460px"
              />
            </div>
          )}
        </>
      )}

      {analysisMessage && (
        <div className="rounded-xl border border-[#eeddd3] bg-white p-5 shadow-xs">
          <h2 className="text-sm font-mono font-bold text-slate-900 mb-2">
            Image Comparison Result
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
            {analysisMessage}
          </p>
        </div>
      )}

      {/* Change Metrics & Interpretation Breakdown */}
      {changeResult && (
        <div className="space-y-6">
          {/* Land Improvement & Environmental Health Banner */}
          <div className="rounded-xl border border-[#eeddd3] bg-white p-5 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#eeddd3] pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 border border-emerald-200">
                  <Sprout className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-mono font-bold text-slate-900">
                      {changeResult.landImprovementLabel || 'Land Dynamics Evaluation'}
                    </h2>
                    {getStatusBadge(changeResult.landImprovementStatus)}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 font-sans">
                    {changeResult.landImprovementDescription || 'Continuous observation between acquisitions'}
                  </p>
                </div>
              </div>

              {changeResult.landImprovementScore !== undefined && (
                <div className="flex items-center gap-3 self-end sm:self-auto bg-[#FFF9F4] px-3.5 py-1.5 rounded-lg border border-[#eeddd3]">
                  <span className="text-[11px] font-mono text-slate-600">Land Health Score</span>
                  <span className={`text-base font-mono font-bold ${changeResult.landImprovementScore >= 70 ? 'text-emerald-700' : changeResult.landImprovementScore >= 45 ? 'text-amber-700' : 'text-rose-700'}`}>
                    {changeResult.landImprovementScore}/100
                  </span>
                </div>
              )}
            </div>

            {/* Environmental Factors & Spectral Deltas Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="rounded-lg bg-[#FFF9F4] p-3 border border-[#eeddd3] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-emerald-700 flex items-center gap-1 font-semibold">
                    <Sprout className="w-3.5 h-3.5" /> Vegetation Vigor (ΔNDVI)
                  </span>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">Photosynthetic canopy delta</p>
                </div>
                <span className={`text-sm font-mono font-bold ${(changeResult.deltaNdvi || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {(changeResult.deltaNdvi || 0) >= 0 ? '+' : ''}{(changeResult.deltaNdvi || 0).toFixed(3)}
                </span>
              </div>

              <div className="rounded-lg bg-[#FFF9F4] p-3 border border-[#eeddd3] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-[#FD1843] flex items-center gap-1 font-semibold">
                    <Droplets className="w-3.5 h-3.5" /> Surface Moisture (ΔNDWI)
                  </span>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">Water body & wetness shift</p>
                </div>
                <span className={`text-sm font-mono font-bold ${(changeResult.deltaNdwi || 0) >= 0 ? 'text-[#FD1843]' : 'text-amber-700'}`}>
                  {(changeResult.deltaNdwi || 0) >= 0 ? '+' : ''}{(changeResult.deltaNdwi || 0).toFixed(3)}
                </span>
              </div>

              <div className="rounded-lg bg-[#FFF9F4] p-3 border border-[#eeddd3] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-amber-700 flex items-center gap-1 font-semibold">
                    <Building2 className="w-3.5 h-3.5" /> Imperviousness (NDBI)
                  </span>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">Built-up structure delta</p>
                </div>
                <span className={`text-sm font-mono font-bold ${(changeResult.deltaNdbi || 0) >= 0 ? 'text-amber-700' : 'text-slate-600'}`}>
                  {(changeResult.deltaNdbi || 0) >= 0 ? '+' : ''}{(changeResult.deltaNdbi || 0).toFixed(3)}
                </span>
              </div>
            </div>
          </div>

          {/* KPI Metrics Row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <span className="text-xs font-mono text-rose-700 font-semibold flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> Built-up Change
              </span>
              <p className="mt-2 text-2xl font-mono font-bold text-slate-900">
                {changeResult.builtUpChangePercentage > 0 ? '+' : ''}
                {changeResult.builtUpChangePercentage}%
              </p>
              <p className="mt-1 text-[11px] text-slate-600 font-mono">
                Impervious concrete & road footprint
              </p>
            </div>

            <div className={`rounded-xl border p-4 ${changeResult.vegetationChangePercentage >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <span className={`text-xs font-mono font-semibold flex items-center gap-1.5 ${changeResult.vegetationChangePercentage >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {changeResult.vegetationChangePercentage >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                Vegetation Dynamics
              </span>
              <p className="mt-2 text-2xl font-mono font-bold text-slate-900">
                {changeResult.vegetationChangePercentage > 0 ? '+' : ''}
                {changeResult.vegetationChangePercentage}%
              </p>
              <p className="mt-1 text-[11px] text-slate-600 font-mono">
                {changeResult.vegetationChangePercentage >= 0 ? 'Photosynthetic canopy gain' : 'NDVI vegetative density reduction'}
              </p>
            </div>

            <div className="rounded-xl border border-[#FD1843]/20 bg-[#FD1843]/10 p-4">
              <span className="text-xs font-mono text-[#FD1843] font-semibold flex items-center gap-1.5">
                <Droplets className="w-4 h-4" /> Water Body Shift
              </span>
              <p className="mt-2 text-2xl font-mono font-bold text-[#FD1843]">
                {changeResult.waterChangePercentage > 0 ? '+' : ''}
                {changeResult.waterChangePercentage}%
              </p>
              <p className="mt-1 text-[11px] text-slate-600 font-mono">
                NDWI reservoir & surface extent
              </p>
            </div>

            <div className="rounded-xl border border-[#eeddd3] bg-white p-4 shadow-xs">
              <span className="text-xs font-mono text-slate-500 font-semibold">
                Net Altered Footprint
              </span>
              <p className="mt-2 text-2xl font-mono font-bold text-slate-900">
                {changeResult.netChangedAreaHa.toLocaleString()} ha
              </p>
              <p className="mt-1 text-[11px] text-slate-500 font-mono">
                Total surveyed surface deviation
              </p>
            </div>
          </div>

          {/* AI Bi-Temporal Narrative */}
          <div className="rounded-xl border border-[#eeddd3] bg-white p-6 space-y-3 shadow-xs">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#FD1843] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Scientific Earth Observation Interpretation</span>
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-line">
              {changeResult.aiExplanation}
            </p>
          </div>

          {/* Transition Matrix */}
          {changeResult.transitions && changeResult.transitions.length > 0 && (
            <div className="rounded-xl border border-[#eeddd3] bg-white p-5 space-y-3 shadow-xs">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#FD1843]" />
                <span>Land-Cover Transition Matrix (T1 Baseline → T2 Final)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#eeddd3] text-slate-500">
                      <th className="pb-2 font-semibold">T1 Origin Class</th>
                      <th className="pb-2 font-semibold">T2 Destination Class</th>
                      <th className="pb-2 font-semibold">Net Extent</th>
                      <th className="pb-2 font-semibold">AOI Ratio</th>
                      <th className="pb-2 font-semibold">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eeddd3] text-slate-700">
                    {changeResult.transitions.map((t, idx) => (
                      <tr key={idx} className="hover:bg-[#FFF9F4]">
                        <td className="py-2.5 text-slate-700 font-medium">{t.fromClass}</td>
                        <td className="py-2.5 text-slate-900 font-semibold flex items-center gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 text-[#FD1843] inline" /> {t.toClass}
                        </td>
                        <td className="py-2.5 text-slate-700">{t.areaHa ? `${t.areaHa} ha` : `${t.areaSqKm} km²`}</td>
                        <td className="py-2.5 text-[#FD1843] font-bold">{t.percentageOfAoi}%</td>
                        <td className="py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${t.category === 'LAND_IMPROVEMENT' || t.category === 'HYDROLOGICAL_RECHARGE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : t.category === 'URBAN_EXPANSION' ? 'bg-amber-50 text-amber-700 border border-amber-200' : t.category === 'VEGETATION_LOSS' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700'}`}>
                            {t.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Change Regions Table */}
          {changeResult.changeRegions && changeResult.changeRegions.length > 0 && (
            <div className="rounded-xl border border-[#eeddd3] bg-white p-5 space-y-3 shadow-xs">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-700">
                Identified Land-Cover Transition Sectors & Hotspots
              </h3>
              <div className="space-y-2">
                {changeResult.changeRegions.map((reg) => (
                  <div
                    key={reg.id}
                    className="flex items-center justify-between rounded-lg border border-[#eeddd3] bg-[#FFF9F4] p-3 text-xs font-mono"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{reg.type}</p>
                      {reg.coordinates && (
                        <p className="text-slate-500 text-[11px]">
                          Target Coordinates: {reg.coordinates[0]}° N, {reg.coordinates[1]}° E
                        </p>
                      )}
                    </div>
                    <span className={`rounded px-2.5 py-1 font-bold ${reg.changePercent >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                      {reg.changePercent > 0 ? `+${reg.changePercent}%` : `${reg.changePercent}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
