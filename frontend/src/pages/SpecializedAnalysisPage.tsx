import React, { useState } from 'react';
import {
  PieChart,
  Target,
  Flame,
  Sprout,
  Building2,
  Droplets,
  Layers,
  Bot,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertTriangle,
  FileImage,
  RefreshCw,
  BarChart3,
  Sliders,
  Compass,
} from 'lucide-react';
import { SatelliteImage, Project, AnalysisSession } from '../types/index.js';
import { MapViewer } from '../components/MapViewer.js';
import { SpectralChart } from '../components/SpectralChart.js';
import { ConfidenceBadge } from '../components/ConfidenceBadge.js';
import { ComparisonSlider } from '../components/ComparisonSlider.js';
import { analysisService } from '../services/analysis.service.js';

export type AnalysisFeatureMode =
  | 'land-cover'
  | 'object-detection'
  | 'disaster-analysis'
  | 'agriculture-analysis'
  | 'urban-growth'
  | 'water-vegetation';

interface SpecializedAnalysisPageProps {
  mode: AnalysisFeatureMode;
  images: SatelliteImage[];
  activeProject: Project | null;
  onNavigateToAssistant: (img: SatelliteImage, customPrompt?: string) => void;
  onSelectImage: (img: SatelliteImage) => void;
}

export const SpecializedAnalysisPage: React.FC<SpecializedAnalysisPageProps> = ({
  mode,
  images,
  activeProject,
  onNavigateToAssistant,
  onSelectImage,
}) => {
  const [selectedImageId, setSelectedImageId] = useState<string>(images[0]?.id || '');
  const [secondaryImageId, setSecondaryImageId] = useState<string>(images[1]?.id || images[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [calculatedData, setCalculatedData] = useState<any>(null);
  const [naturalLanguageAnswer, setNaturalLanguageAnswer] = useState<string>('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [workingAssistant, setWorkingAssistant] = useState<string>('Geospatial DL Specialist');
  const [activeModel, setActiveModel] = useState<string>('OpenRouter Auto-Switch');
  const [analyzedImageId, setAnalyzedImageId] = useState<string | null>(null);
  const [moduleRoute, setModuleRoute] = useState<Record<string, any> | null>(null);
  const [moduleResult, setModuleResult] = useState<Record<string, any> | null>(null);

  const selectedImage = images.find((i) => i.id === selectedImageId) || images[0];
  const secondaryImage = images.find((i) => i.id === secondaryImageId) || images[1] || images[0];

  // Configuration for each requested module
  const featureConfigs = {
    'land-cover': {
      title: 'Land Cover Classification',
      subtitle: 'Multi-Class Land Surface Partitioning & Corine Land Cover (CLC-19)',
      icon: PieChart,
      color: 'text-[#FD1843]',
      badge: 'GeoRSCLIP + BigEarthNet',
      defaultQuery: 'What land-cover classes are present and what is the exact percentage breakdown?',
      quickActions: [
        'Calculate land/water and vegetation percentage',
        'Identify all Corine Land Cover classes present',
        'Classify artificial surfaces vs agricultural fields',
      ],
    },
    'object-detection': {
      title: 'Object Detection & Feature Grounding',
      subtitle: 'Zero-Shot Spatial Delineation & Bounding Box Localization',
      icon: Target,
      color: 'text-amber-400',
      badge: 'SAM + Grounding-Net',
      defaultQuery: 'Detect and ground all prominent runways, buildings, and infrastructure features with bounding boxes',
      quickActions: [
        'Detect runways, taxiways, and airport terminals',
        'Ground industrial storage facilities and commercial units',
        'Localize surface water reservoirs and lake perimeters',
      ],
    },
    'disaster-analysis': {
      title: 'Disaster Analysis & Impact Assessment',
      subtitle: 'Flood Inundation, Wildfire Burn Scars & Damaged Region Segmentation',
      icon: Flame,
      color: 'text-rose-400',
      badge: 'SAVI / NBR + SAM',
      defaultQuery: 'Is there evidence of flooding, burn scars, or storm damage in this satellite scene?',
      quickActions: [
        'Analyze flood inundation extent using NDWI and SAR',
        'Calculate wildfire burn severity (NBR / SAVI delta)',
        'Delineate critical damaged infrastructure zones',
      ],
    },
    'agriculture-analysis': {
      title: 'Agriculture & Crop Health Analysis',
      subtitle: 'NDVI Canopy Vigor, Crop Phenology & Chlorophyll Stress Profiling',
      icon: Sprout,
      color: 'text-emerald-400',
      badge: 'NDVI + Spectral Engine',
      defaultQuery: 'Calculate NDVI, identify vegetation health, and classify stressed vs healthy crop canopy',
      quickActions: [
        'Calculate NDVI mean and healthy canopy percentage',
        'Evaluate agricultural parcel crop stress levels',
        'Identify irrigation boundaries and soil moisture',
      ],
    },
    'urban-growth': {
      title: 'Urban Growth & Built-up Expansion',
      subtitle: 'Bi-Temporal Impervious Surface Differencing & Concrete Densification',
      icon: Building2,
      color: 'text-indigo-400',
      badge: 'NDBI Differencing + CDVQA',
      defaultQuery: 'How much has the urban built-up area increased between these two acquisition dates?',
      quickActions: [
        'Calculate built-up area growth percentage (NDBI)',
        'Identify agricultural land converted to urban fabric',
        'Quantify impervious surface expansion in km²',
      ],
    },
    'water-vegetation': {
      title: 'Water & Vegetation Analysis',
      subtitle: 'Exact Analytical Computation: NDVI (Vegetation), NDWI (Water), NDBI (Built-up)',
      icon: Droplets,
      color: 'text-sky-400',
      badge: 'NDVI / NDWI / NDBI Pipeline',
      defaultQuery: 'Calculate NDVI, NDWI, and NDBI percentages and verify land versus water split',
      quickActions: [
        'What is the exact land vs water percentage?',
        'Calculate NDVI vegetation vigor and NDWI water coverage',
        'Verify NDBI built-up impervious surface index',
      ],
    },
  };

  const currentConfig = featureConfigs[mode];
  const Icon = currentConfig.icon;

  // Execute actual analytical computation + AI explanation pipeline
  const executeAnalysis = async (queryText?: string) => {
    if (!selectedImage) return;
    setLoading(true);
    setAnalysisError(null);
    const query = queryText || currentConfig.defaultQuery;

    try {
      // 1. Calculate and analyze via backend AI + Python ML pipeline
      const session: AnalysisSession = await analysisService.query({
        imageId: selectedImage.id,
        query: query,
        imageContext: selectedImage,
        imageBase64: selectedImage.file_url?.startsWith('data:') ? selectedImage.file_url : undefined,
        secondaryImageId:
          (mode === 'urban-growth' || mode === 'disaster-analysis') && secondaryImage?.id !== selectedImage.id
            ? secondaryImage?.id
            : undefined,
        secondaryImageContext:
          (mode === 'urban-growth' || mode === 'disaster-analysis') && secondaryImage?.id !== selectedImage.id
            ? secondaryImage
            : undefined,
        inputMode: mode === 'urban-growth' ? 'BITEMPORAL_PAIR' : 'AUTO',
        projectId: activeProject?.id || selectedImage.project_id || null,
        parameters: { selected_module: mode },
      });

      setCalculatedData(session.result);
      setNaturalLanguageAnswer(session.result.directAnswer || session.result.summary);
      setWorkingAssistant(session.result.workingAssistant || 'Image Analysis');
      setActiveModel(session.result.autoSwitchedModel || session.result.llmModel || 'Deterministic Image Analysis');
      setAnalyzedImageId(selectedImage.id);
      setModuleRoute(session.result.moduleRoute || null);
      setModuleResult(session.result.moduleResult || null);
    } catch (err: any) {
      console.warn('Specialized analysis error:', err);
      setCalculatedData(null);
      setNaturalLanguageAnswer('');
      setAnalyzedImageId(null);
      setModuleRoute(null);
      setModuleResult(null);
      setAnalysisError(err.message || 'Image analysis failed. Please retry after checking the selected image.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="rounded-2xl border border-[#eeddd3] bg-gradient-to-r from-white via-[#FFF9F4] to-[#ffe5ea] p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FD1843]/30 bg-[#FD1843]/10 px-3 py-1 text-xs font-mono text-[#FD1843] mb-3">
              <Icon className="w-3.5 h-3.5 text-[#FD1843]" />
              <span>{currentConfig.badge}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold font-mono text-slate-900">
              {currentConfig.title}
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-600 max-w-2xl">
              {currentConfig.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateToAssistant(selectedImage, currentConfig.defaultQuery)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FD1843] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e01239] transition-all font-mono shadow-md shadow-[#FD1843]/20"
            >
              <Bot className="w-4 h-4" />
              <span>Open in AI Assistant</span>
            </button>
          </div>
        </div>
      </div>

      {/* Target Scene & Pair Selection Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-[#eeddd3] bg-white p-4 shadow-xs">
        {/* Primary Image */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-700 font-semibold flex items-center gap-1.5">
            <FileImage className="w-3.5 h-3.5 text-[#FD1843]" />
            <span>Target Satellite Image:</span>
          </label>
          <select
            value={selectedImageId}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedImageId(newId);
              setCalculatedData(null);
              setNaturalLanguageAnswer('');
              setAnalysisError(null);
              setAnalyzedImageId(null);
              const found = images.find((i) => i.id === newId);
              if (found) onSelectImage(found);
            }}
            className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#FD1843] focus:outline-none"
          >
            {images.map((img) => (
              <option key={img.id} value={img.id}>
                {img.file_name} ({img.satellite} • {img.acquisition_date})
              </option>
            ))}
          </select>
        </div>

        {/* Secondary Image if Urban Growth or Disaster Comparison */}
        {(mode === 'urban-growth' || mode === 'disaster-analysis') && (
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-700 font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Comparative Secondary Acquisition (T2):</span>
            </label>
            <select
              value={secondaryImageId}
              onChange={(e) => {
                setSecondaryImageId(e.target.value);
                setCalculatedData(null);
                setNaturalLanguageAnswer('');
                setAnalyzedImageId(null);
              }}
              className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#FD1843] focus:outline-none"
            >
              {images.map((img) => (
                <option key={img.id} value={img.id}>
                  {img.file_name} ({img.satellite} • {img.acquisition_date})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Quick Scientific Action Triggers */}
      <div className="space-y-2">
        <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
          Quick Analytical Inferences:
        </span>
        <div className="flex flex-wrap gap-2">
          {currentConfig.quickActions.map((action, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => executeAnalysis(action)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#eeddd3] bg-white px-3 py-2 text-xs font-mono text-slate-700 hover:border-[#FD1843]/50 hover:text-[#FD1843] hover:bg-[#FFF9F4] transition-all disabled:opacity-50 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FD1843]" />
              <span>{action}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => executeAnalysis()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#FD1843] px-4 py-2 text-xs font-mono font-bold text-white hover:bg-[#e01239] transition-all disabled:opacity-50 shadow-md shadow-[#FD1843]/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Computing Analysis...' : 'Run Full Analysis'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Map/Comparison Stage & Telemetry Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Map Viewer or Comparison Slider */}
        <div className="rounded-xl border border-[#eeddd3] bg-white p-4 lg:col-span-2 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#eeddd3] pb-3">
            <span className="text-xs font-mono font-semibold text-slate-900 flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#FD1843]" />
              {mode === 'urban-growth' ? 'Bi-Temporal Comparison Stage' : 'High-Resolution Earth Observation View'}
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              GSD: {selectedImage?.resolution_meters != null ? `${selectedImage.resolution_meters}m` : 'Unavailable'} • Sensor: {selectedImage?.sensor || 'Unavailable'}
            </span>
          </div>

          {mode === 'urban-growth' && selectedImage && secondaryImage ? (
            <ComparisonSlider beforeImage={selectedImage} afterImage={secondaryImage} />
          ) : selectedImage ? (
            <div className="h-[440px] rounded-lg overflow-hidden border border-[#eeddd3]">
              <MapViewer
                selectedImage={selectedImage}
                analysisType={
                  mode === 'agriculture-analysis'
                    ? 'VEGETATION'
                    : mode === 'water-vegetation'
                    ? 'WATER_DETECTION'
                    : mode === 'urban-growth'
                    ? 'BUILT_UP_ANALYSIS'
                    : 'OBJECT_DETECTION'
                }
              />
            </div>
          ) : null}
        </div>

        {/* Right 1 Col: Rigorous Calculation Breakdown */}
        <div className="space-y-4">
          {/* Calculated Indices Cards */}
          <div className="rounded-xl border border-[#eeddd3] bg-white p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#FD1843] flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-[#FD1843]" />
                Calculated Area & Spectral Values
              </span>
              {analyzedImageId === selectedImage?.id && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-mono text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Grounded
                </span>
              )}
            </div>

            {analyzedImageId === selectedImage?.id && calculatedData?.statistics ? (
              <div className="space-y-2.5 font-mono text-xs">
                {/* Water Percentage */}
                <div className="flex items-center justify-between rounded-lg bg-[#FFF9F4] p-2.5 border border-[#eeddd3]">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    Water Surface (NDWI):
                  </span>
                  <span className="font-bold text-sky-700">
                    {calculatedData.statistics.waterPercentage !== undefined && calculatedData.statistics.waterPercentage !== null
                      ? `${calculatedData.statistics.waterPercentage}%`
                      : 'Unavailable'}
                  </span>
                </div>

                {/* Vegetation Percentage */}
                <div className="flex items-center justify-between rounded-lg bg-[#FFF9F4] p-2.5 border border-[#eeddd3]">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Vegetation Canopy (NDVI):
                  </span>
                  <span className="font-bold text-emerald-700">
                    {calculatedData.statistics.vegetationPercentage !== undefined && calculatedData.statistics.vegetationPercentage !== null
                      ? `${calculatedData.statistics.vegetationPercentage}%`
                      : 'Unavailable'}
                  </span>
                </div>

                {/* Built-up Percentage */}
                <div className="flex items-center justify-between rounded-lg bg-[#FFF9F4] p-2.5 border border-[#eeddd3]">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Built-up / Impervious (NDBI):
                  </span>
                  <span className="font-bold text-amber-700">
                    {calculatedData.statistics.builtUpPercentage !== undefined && calculatedData.statistics.builtUpPercentage !== null
                      ? `${calculatedData.statistics.builtUpPercentage}%`
                      : 'Unavailable'}
                  </span>
                </div>

                {/* Mean Index */}
                {calculatedData.statistics.meanIndex !== undefined && (
                  <div className="flex items-center justify-between rounded-lg bg-[#FFF9F4] p-2.5 border border-[#eeddd3]">
                    <span className="text-slate-600">Radiometric Index Mean:</span>
                    <span className="font-bold text-slate-800">
                      {calculatedData.statistics.meanIndex > 0 ? '+' : ''}
                      {calculatedData.statistics.meanIndex.toFixed(3)}
                    </span>
                  </div>
                )}

                {/* Pipeline Provenance */}
                <div className="rounded-lg bg-[#FFF9F4] p-2.5 border border-[#eeddd3] text-[10px] font-mono text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Method:</span>
                    <span className="text-emerald-700 font-semibold">Rasterio / Pixel Mask Engine</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence:</span>
                    <span className="text-[#FD1843] font-semibold">
                      {typeof calculatedData.confidence === 'number'
                        ? `${(calculatedData.confidence * 100).toFixed(1)}%`
                        : 'Not calibrated'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sensor:</span>
                    <span className="text-slate-700">{selectedImage?.satellite} ({selectedImage?.sensor})</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#eeddd3] bg-[#FFF9F4] p-6 text-center space-y-3">
                <Activity className="w-6 h-6 text-slate-400 mx-auto animate-pulse" />
                <div className="space-y-1">
                  <p className="text-xs font-mono text-slate-800 font-semibold">
                    Awaiting Image Analysis
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    Click "Run Full Analysis" or choose an analytical inference to compute true pixel-derived spectral metrics for {selectedImage?.file_name}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => executeAnalysis()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#FD1843]/10 border border-[#FD1843]/30 px-3 py-1.5 text-xs font-mono text-[#FD1843] hover:bg-[#FD1843]/20 transition-colors disabled:opacity-50 font-semibold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Computing...' : 'Analyze Now'}</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Natural Language Explanation Card */}
      <div className="rounded-xl border border-[#eeddd3] bg-white p-5 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eeddd3] pb-3">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#FD1843]" />
            <span className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider">
              {workingAssistant}:
            </span>
            <span className="rounded bg-[#FD1843]/10 px-2 py-0.5 text-[10px] font-mono text-[#FD1843] border border-[#FD1843]/20 font-semibold">
              {activeModel}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            Rule: Calculated Result → AI Natural Language Explanation
          </span>
        </div>

        <p className="text-sm font-sans leading-relaxed text-slate-700 font-normal">
          {analysisError ? (
            <span className="text-rose-700">{analysisError}</span>
          ) : naturalLanguageAnswer || (
            analyzedImageId === selectedImage?.id
              ? `Analysis completed for ${selectedImage?.file_name}. Spectral indices computed based on optical and multispectral band reflectance.`
              : `Ready to analyze ${selectedImage?.file_name} (${selectedImage?.satellite} • ${selectedImage?.sensor}). Click "Run Full Analysis" or pick any of the analytical inferences above to compute the exact spectral indices and land partition statistics.`
          )}
        </p>

        {analyzedImageId === selectedImage?.id && calculatedData?.keyTakeaways && calculatedData.keyTakeaways.length > 0 && (
          <div className="pt-2 border-t border-[#eeddd3] space-y-1">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-600 block">
              Key Scientific Observations:
            </span>
            <ul className="space-y-1 text-xs text-slate-700 font-mono">
              {calculatedData.keyTakeaways.map((takeaway: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#FD1843]">▸</span>
                  <span>{takeaway}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analyzedImageId === selectedImage?.id && moduleResult && (
          <div className="pt-2 border-t border-[#eeddd3] space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-600">
                {moduleResult.module_title || moduleResult.module || 'Module Analysis'}:
              </span>
              <span className="rounded bg-[#FD1843]/10 px-2 py-0.5 text-[10px] font-mono text-[#FD1843] border border-[#FD1843]/20 font-semibold">
                {moduleResult.result_schema}
              </span>
              {moduleRoute?.route_source && (
                <span className="rounded bg-white px-2 py-0.5 text-[10px] font-mono text-slate-500 border border-[#eeddd3]">
                  routed via {moduleRoute.route_source}
                </span>
              )}
            </div>
            {Array.isArray(moduleResult.key_findings) && moduleResult.key_findings.length > 0 && (
              <ul className="space-y-1 text-xs font-mono text-slate-700">
                {moduleResult.key_findings.map((finding: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#FD1843]">▸</span>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            )}
            {moduleResult.method && (
              <p className="text-[11px] font-mono text-slate-500">Method: {String(moduleResult.method)}</p>
            )}
            {Array.isArray(moduleResult.limitations) && moduleResult.limitations.length > 0 && (
              <ul className="space-y-1 text-[11px] font-mono text-slate-500">
                {moduleResult.limitations.map((limitation: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
