import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Layers,
  ShieldCheck,
  Bookmark,
  Download,
  AlertCircle,
  FileImage,
  RefreshCw,
  Eye,
  Scale,
  Radio,
  FileText,
  TrendingUp,
  UploadCloud,
  Split,
  X,
  User,
  Copy,
  Check,
  MessageSquare,
  HelpCircle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Trash2,
  Maximize2,
} from 'lucide-react';
import { SatelliteImage, Project, AnalysisSession, AnalysisType } from '../types/index.js';
import { analysisService } from '../services/analysis.service.js';
import { MapViewer } from '../components/MapViewer.js';
import { ComparisonSlider } from '../components/ComparisonSlider.js';
import { ImageUploader } from '../components/ImageUploader.js';
import { SpectralChart } from '../components/SpectralChart.js';
import { ConfidenceBadge } from '../components/ConfidenceBadge.js';
import { AgenticTraceViewer } from '../components/AgenticTraceViewer.js';
import { EvaluationCriteriaModal } from '../components/EvaluationCriteriaModal.js';
import { BigEarthNetEvaluationModal } from '../components/BigEarthNetEvaluationModal.js';
import { ConfirmModal } from '../components/ConfirmModal.js';

export interface QAItem {
  id: string;
  imageId: string;
  imageFileName: string;
  imageSatellite: string;
  question: string;
  timestamp: string;
  session: AnalysisSession;
  expandedDetails?: boolean;
}

interface AssistantPageProps {
  images: SatelliteImage[];
  selectedImage: SatelliteImage | null;
  onSelectImage: (image: SatelliteImage) => void;
  activeProject: Project | null;
  projects?: Project[];
  onSessionCreated: (session: AnalysisSession) => void;
  qaHistory: QAItem[];
  currentSession: AnalysisSession | null;
  onQAHistoryChange: React.Dispatch<React.SetStateAction<QAItem[]>>;
  onCurrentSessionChange: (session: AnalysisSession | null) => void;
  onImageUploaded?: (image: SatelliteImage) => void;
}

export const AssistantPage: React.FC<AssistantPageProps> = ({
  images,
  selectedImage,
  onSelectImage,
  activeProject,
  projects = [],
  onSessionCreated,
  qaHistory,
  currentSession,
  onQAHistoryChange,
  onCurrentSessionChange,
  onImageUploaded,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterByCurrentImage, setFilterByCurrentImage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [bigEarthNetModalOpen, setBigEarthNetModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [mapViewMode, setMapViewMode] = useState<'map' | 'comparison'>('map');
  const [activeMask, setActiveMask] = useState<'none' | 'NDVI' | 'NDWI' | 'NDBI' | 'False Color'>('none');
  const [secondaryImageId, setSecondaryImageId] = useState<string>('');
  const [showSpectralSidebar, setShowSpectralSidebar] = useState(true);
  const [deleteQAId, setDeleteQAId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const activeImg = selectedImage || images[0];
  const secondaryImg = images.find((i) => i.id === secondaryImageId) || null;
  const questionsEndRef = useRef<HTMLDivElement | null>(null);

  // Quick Suggested Questions tailored for satellite imagery
  const quickQuestions = [
    {
      category: 'Water Detection',
      icon: '💧',
      question: 'Is there water in this image?',
      type: 'WATER_DETECTION' as AnalysisType,
    },
    {
      category: 'Land / Water Percentage',
      icon: '📊',
      question: 'What is the land/water percentage?',
      type: 'WATER_DETECTION' as AnalysisType,
    },
    {
      category: 'Vegetation Percentage',
      icon: '🌿',
      question: 'What percentage of vegetation is present?',
      type: 'VEGETATION' as AnalysisType,
    },
    {
      category: 'Bi-Temporal Change',
      icon: '🔄',
      question: 'What changed between these two images?',
      type: 'CHANGE_DETECTION' as AnalysisType,
      reqBitemporal: true,
    },
    {
      category: 'Disaster / Flooding',
      icon: '🌊',
      question: 'Is there evidence of flooding?',
      type: 'WATER_DETECTION' as AnalysisType,
    },
    {
      category: 'Urban Growth',
      icon: '🏙️',
      question: 'How much has the urban area increased?',
      type: 'BUILT_UP_ANALYSIS' as AnalysisType,
      reqBitemporal: true,
    },
    {
      category: 'Land Cover Classes',
      icon: '🌍',
      question: 'What land-cover classes are present?',
      type: 'SCENE_CAPTIONING' as any,
    },
    {
      category: 'BigEarthNet CLC-19',
      icon: '🎯',
      question: 'Evaluate land-cover classes and SAR backscatter using trained BigEarthNet weights',
      type: 'GENERAL_QUERY' as any,
      reqBitemporal: false,
      reqOpticalSar: false,
    },
  ];

  const handleExecuteQuery = async (queryText?: string, targetSecondaryId?: string) => {
    const text = (queryText || query).trim();
    if (!text) return;

    if (!activeImg) {
      setUploadModalOpen(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const secId = targetSecondaryId !== undefined ? targetSecondaryId : (secondaryImg?.id || undefined);
      const resolvedSecondaryImageId = secId || activeImg.metadata?.co_registered_pair_id || null;
      const secondaryImageContext = images.find((image) => image.id === resolvedSecondaryImageId);

      const session = await analysisService.query({
        imageId: activeImg.id,
        query: text,
        projectId: activeProject?.id || activeImg.project_id || null,
        imageContext: activeImg.file_url?.startsWith('data:')
          ? { ...activeImg, file_url: '' }
          : activeImg,
        secondaryImageId: resolvedSecondaryImageId,
        secondaryImageContext,
        inputMode: secId ? 'CROSS_MODAL_PAIR' : 'AUTO',
        imageBase64: activeImg.file_url?.startsWith('data:') ? activeImg.file_url : undefined,
      });

      onSessionCreated(session);
      setQuery('');
      setLoading(false);

      // Smooth scroll to results
      setTimeout(() => {
        questionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Remote sensing analysis query failed.');
    }
  };

  const handleSaveQuery = async (qaItem: QAItem) => {
    try {
      await analysisService.saveQuery({
        query: qaItem.question,
        category: qaItem.session.analysis_type,
        projectId: activeProject?.id || undefined,
      });
      setSavedSuccess(qaItem.id);
      setTimeout(() => setSavedSuccess(null), 3000);
    } catch (err) {
      console.warn('Could not save query:', err);
    }
  };

  const handleCopyAnswer = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleExportJSON = (session: AnalysisSession) => {
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `satquery_answer_${session.id.substring(0, 8)}.json`;
    a.click();
  };

  const toggleExpandQA = (id: string) => {
    onQAHistoryChange((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, expandedDetails: !item.expandedDetails } : item
      )
    );
  };

  const handleDeleteQAItem = (id: string) => {
    onQAHistoryChange((prev) => prev.filter((item) => item.id !== id));
    setDeleteQAId(null);
  };

  const handleClearQAHistory = () => {
    onQAHistoryChange([]);
    setShowClearConfirm(false);
  };

  const displayedHistory = filterByCurrentImage && activeImg
    ? qaHistory.filter((item) => item.imageId === activeImg.id)
    : qaHistory;
  const activeImageSession = currentSession?.image_id === activeImg?.id ? currentSession : null;
  const activeImageAnalysis = activeImageSession?.result.imageAnalysis;
  const activeGeoBounds = activeImageAnalysis?.georeferencing?.bounds || activeImg?.bbox || null;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner & Context Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-xl border border-[#eeddd3] bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#FD1843]/10 p-2.5 text-[#FD1843] border border-[#FD1843]/30 shadow-inner">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 font-mono flex items-center gap-2 flex-wrap">
              <span>AI Remote-Sensing Q&A Assistant</span>
              <span className="rounded bg-[#FD1843]/10 px-2 py-0.5 text-[11px] text-[#FD1843] border border-[#FD1843]/30 font-semibold">
                Agentic VQA & Grounding
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Ask questions about the uploaded image; answers use available image pixels and mapped spectral bands.
            </p>
          </div>
        </div>

        {/* Header Action Buttons & Scene Selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Image Upload Button */}
          <button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-mono font-medium text-emerald-700 hover:bg-emerald-100 transition-colors shadow-xs"
          >
            <UploadCloud className="w-4 h-4 text-emerald-600" />
            <span>Upload Image</span>
          </button>

          {/* Primary Scene Selector */}
          {activeImg && (
            <div className="flex items-center gap-2 rounded-xl border border-[#eeddd3] bg-[#FFF9F4] px-3 py-2 text-xs font-mono">
              <FileImage className="w-4 h-4 text-[#FD1843] shrink-0" />
              <span className="text-slate-600 hidden sm:inline">Active Scene:</span>
              <select
                value={activeImg.id}
                onChange={(e) => {
                  const img = images.find((i) => i.id === e.target.value);
                  if (img) onSelectImage(img);
                }}
                className="bg-transparent text-slate-900 focus:outline-none cursor-pointer max-w-[180px] truncate font-semibold"
              >
                {images.map((img) => (
                  <option key={img.id} value={img.id} className="bg-white text-slate-900">
                    {img.satellite} ({img.metadata?.modality || 'OPTICAL'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Secondary Co-Registered Pair Selector */}
          <div className="flex items-center gap-2 rounded-xl border border-[#eeddd3] bg-[#FFF9F4] px-3 py-2 text-xs font-mono">
            <Radio className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-slate-600 hidden sm:inline">Pair / SAR:</span>
            <select
              value={secondaryImageId}
              onChange={(e) => setSecondaryImageId(e.target.value)}
              className="bg-transparent text-slate-900 focus:outline-none cursor-pointer max-w-[150px] truncate font-semibold"
            >
              <option value="" className="bg-white text-slate-500">
                None (Single)
              </option>
              {images
                .filter((img) => img.id !== activeImg?.id)
                .map((img) => (
                  <option key={img.id} value={img.id} className="bg-white text-slate-900">
                    {img.satellite} ({img.metadata?.modality || 'OPTICAL'})
                  </option>
                ))}
            </select>
          </div>

          {/* BigEarthNet Evaluation Button */}
          <button
            type="button"
            onClick={() => setBigEarthNetModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[#FD1843]/30 bg-[#FD1843]/10 px-3 py-2 text-xs font-mono font-medium text-[#FD1843] hover:bg-[#FD1843]/20 transition-colors shadow-xs"
            title="Evaluate Uploaded Scene with Trained BigEarthNet Dataset"
          >
            <Sparkles className="w-4 h-4 text-[#FD1843]" />
            <span className="hidden sm:inline">BigEarthNet Eval</span>
          </button>

          <button
            type="button"
            onClick={() => setEvalModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[#eeddd3] bg-white px-2.5 py-2 text-xs font-mono text-slate-700 hover:text-slate-900 hover:bg-[#FFF9F4] transition-colors shadow-xs"
            title="View Evaluation & Benchmarks"
          >
            <Scale className="w-4 h-4 text-[#FD1843]" />
          </button>
        </div>
      </div>

      {/* Primary Satellite Image View & Geospatial Telemetry */}
      {activeImg ? (
        <div className="rounded-2xl border border-[#eeddd3] bg-white overflow-hidden shadow-xs">
          {/* Active Image Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeddd3] bg-[#FFF9F4] px-4 py-3 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-2 text-slate-700">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <FileImage className="w-4 h-4 text-[#FD1843]" />
                {activeImg.file_name}
              </span>
              <span className="rounded bg-[#FD1843]/10 px-2 py-0.5 text-[#FD1843] border border-[#FD1843]/30 font-semibold">
                {activeImg.satellite}{activeImg.sensor ? ` (${activeImg.sensor})` : ''}
              </span>
              <span className="rounded bg-white px-2 py-0.5 text-slate-700 border border-[#eeddd3]">
                {activeImg.resolution_meters != null
                  ? `${activeImg.resolution_meters}m GSD`
                  : '[GSD unavailable]'}
              </span>
              <span className="rounded bg-white px-2 py-0.5 text-slate-700 border border-[#eeddd3]">
                Date: {activeImg.acquisition_date || 'Unavailable'}
              </span>
              <span className="rounded bg-white px-2 py-0.5 text-slate-700 border border-[#eeddd3]">
                Cloud: {activeImg.cloud_percentage !== null && activeImg.cloud_percentage !== undefined
                  ? `${activeImg.cloud_percentage}%`
                  : 'Unavailable'}
              </span>
              {activeGeoBounds
                && Number.isFinite(activeGeoBounds.west)
                && Number.isFinite(activeGeoBounds.south)
                && Number.isFinite(activeGeoBounds.east)
                && Number.isFinite(activeGeoBounds.north)
                && activeGeoBounds.west < activeGeoBounds.east
                && activeGeoBounds.south < activeGeoBounds.north
                ? (
                  <span className="text-slate-500 text-[11px] hidden md:inline">
                    ({((activeGeoBounds.south + activeGeoBounds.north) / 2).toFixed(4)}°,
                    {((activeGeoBounds.west + activeGeoBounds.east) / 2).toFixed(4)}°)
                  </span>
                )
                : (
                  <span className="text-slate-500 text-[11px] hidden md:inline">
                    Georeferencing unavailable
                  </span>
                )}
            </div>

            {/* View Mode & Map Controls */}
            <div className="flex items-center gap-2">
              {secondaryImg && (
                <div className="flex items-center rounded-lg bg-white p-0.5 border border-[#eeddd3] text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setMapViewMode('map')}
                    className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                      mapViewMode === 'map'
                        ? 'bg-[#FD1843] text-white font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapViewMode('comparison')}
                    className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                      mapViewMode === 'comparison'
                        ? 'bg-[#FD1843] text-white font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Split className="w-3 h-3" />
                    <span>Swipe Compare</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowSpectralSidebar(!showSpectralSidebar)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-mono transition-colors flex items-center gap-1 ${
                  showSpectralSidebar
                    ? 'border-[#FD1843]/30 bg-[#FD1843]/10 text-[#FD1843] font-semibold'
                    : 'border-[#eeddd3] bg-white text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{showSpectralSidebar ? 'Hide Telemetry' : 'Show Telemetry'}</span>
              </button>
            </div>
          </div>

          {/* Map Viewer Layout */}
          <div className={`grid grid-cols-1 ${showSpectralSidebar ? 'lg:grid-cols-3' : ''}`}>
            <div className={showSpectralSidebar ? 'lg:col-span-2' : 'w-full'}>
              {mapViewMode === 'comparison' && secondaryImg ? (
                <ComparisonSlider
                  beforeImage={activeImg}
                  afterImage={secondaryImg}
                  height="440px"
                />
              ) : (
                <MapViewer
                  image={activeImg}
                  detections={activeImageSession?.result.detections || []}
                  geojsonLayers={activeImageSession?.result.geojsonLayers}
                  analysisOverlays={activeImageAnalysis?.overlays}
                  geographicBounds={activeGeoBounds}
                  analysisPerformed={Boolean(activeImageAnalysis)}
                  spectralMaskType={activeMask}
                  onSpectralMaskChange={setActiveMask}
                  height="440px"
                />
              )}
            </div>

            {/* Side Spectral Telemetry Panel */}
            {showSpectralSidebar && (
              <div className="border-t lg:border-t-0 lg:border-l border-[#eeddd3] p-4 bg-[#FFF9F4] space-y-4 max-h-[440px] overflow-y-auto">
                <SpectralChart
                  statistics={activeImageSession?.result.statistics}
                  indexName={activeImageSession?.result.spectralInterpretation?.indexName || 'Spectral Radiance'}
                  formula={activeImageSession?.result.spectralInterpretation?.formula || 'Band Ratio Analysis'}
                />

                {/* Spectral Indices Summary Table */}
                {activeImageSession?.result.statistics && (
                  <div className="rounded-lg border border-[#eeddd3] bg-white p-3 space-y-2 text-xs font-mono shadow-xs">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                      Radiometric Indices (Auto-Computed)
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded bg-[#FFF9F4] p-2 border border-[#eeddd3]">
                        <span className="text-[10px] text-slate-500 block">NDVI</span>
                        <span className="text-sm font-bold text-emerald-700">
                          {activeImageSession.result.statistics.meanIndex !== undefined
                            ? activeImageSession.result.statistics.meanIndex > 0
                              ? `+${activeImageSession.result.statistics.meanIndex.toFixed(2)}`
                              : activeImageSession.result.statistics.meanIndex.toFixed(2)
                            : '--'}
                        </span>
                      </div>
                      <div className="rounded bg-[#FFF9F4] p-2 border border-[#eeddd3]">
                        <span className="text-[10px] text-slate-500 block">Water %</span>
                        <span className="text-sm font-bold text-[#FD1843]">
                          {activeImageSession.result.statistics.waterPercentage !== undefined
                            ? `${activeImageSession.result.statistics.waterPercentage}%`
                            : '--'}
                        </span>
                      </div>
                      <div className="rounded bg-[#FFF9F4] p-2 border border-[#eeddd3]">
                        <span className="text-[10px] text-slate-500 block">Built-up %</span>
                        <span className="text-sm font-bold text-amber-700">
                          {activeImageSession.result.statistics.builtUpPercentage !== undefined
                            ? `${activeImageSession.result.statistics.builtUpPercentage}%`
                            : '--'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-[#eeddd3] bg-white p-8 sm:p-12 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FD1843]/10 border border-[#FD1843]/30 text-[#FD1843] mb-4 shadow-inner">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h2 className="text-base sm:text-lg font-bold font-mono text-slate-900 mb-2">
            No Satellite Image Loaded
          </h2>
          <p className="max-w-xl mx-auto text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
            Please upload a satellite image scene in any supported format (GeoTIFF, TIFF, Multispectral JPEG, or PNG) to enable AI Visual Question Answering, spectral indices calculation, and land-cover analysis.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#FD1843] px-5 py-2.5 text-xs font-mono font-bold text-white hover:bg-[#e01239] transition-all shadow-lg shadow-[#FD1843]/20"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Satellite Image</span>
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
            <div className="rounded-xl border border-[#eeddd3] bg-[#FFF9F4] p-3.5">
              <span className="text-[11px] font-mono font-bold text-[#FD1843] block mb-1">Supported Formats</span>
              <p className="text-[11px] text-slate-600">GeoTIFF (.tif, .tiff), PNG, JPEG up to 50MB per scene.</p>
            </div>
            <div className="rounded-xl border border-[#eeddd3] bg-[#FFF9F4] p-3.5">
              <span className="text-[11px] font-mono font-bold text-emerald-700 block mb-1">Sensors & Satellites</span>
              <p className="text-[11px] text-slate-600">Sentinel-2, Landsat-8/9, ISRO Resourcesat/Cartosat, SAR, and Aerial/Drone.</p>
            </div>
            <div className="rounded-xl border border-[#eeddd3] bg-[#FFF9F4] p-3.5">
              <span className="text-[11px] font-mono font-bold text-indigo-700 block mb-1">Capabilities</span>
              <p className="text-[11px] text-slate-600">Land-cover, vegetation NDVI, water NDWI, built-up NDBI, and object detection.</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Question Input Section */}
      <div className="rounded-2xl border border-[#eeddd3] bg-white p-5 shadow-xs space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#FD1843]" />
            <h2 className="text-sm font-mono font-bold text-slate-900">
              Ask Questions About This Satellite Image
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {displayedHistory.length} Question{displayedHistory.length === 1 ? '' : 's'} Answered
          </span>
        </div>

        {/* Input Bar */}
        <div className="relative flex items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecuteQuery()}
            placeholder="Ask any question about this image (e.g., 'What is the resolution?', 'Are there water bodies?', 'Describe the land cover', 'Count runways')..."
            className="w-full rounded-xl border border-[#eeddd3] bg-[#FFF9F4] py-3.5 pl-4 pr-32 text-sm text-slate-900 placeholder-slate-400 focus:border-[#FD1843] focus:outline-none font-mono shadow-xs"
          />
          <button
            type="button"
            onClick={() => handleExecuteQuery()}
            disabled={loading || !query.trim()}
            className="absolute right-2 rounded-lg bg-[#FD1843] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e01239] disabled:opacity-40 shadow-md shadow-[#FD1843]/20 transition-all font-mono flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Answering...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </>
            )}
          </button>
        </div>

        {/* Suggested Quick Questions */}
        <div className="space-y-2">
          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#FD1843]" />
            Click any question to ask immediately:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(q.question);
                  if (q.reqOpticalSar) {
                    const sarImg = images.find((i) => i.metadata?.modality === 'SAR');
                    if (sarImg) setSecondaryImageId(sarImg.id);
                    handleExecuteQuery(q.question, sarImg?.id);
                  } else if (q.reqBitemporal) {
                    const t2 = images.find((i) => i.id !== activeImg?.id);
                    if (t2) setSecondaryImageId(t2.id);
                    handleExecuteQuery(q.question, t2?.id);
                  } else {
                    handleExecuteQuery(q.question);
                  }
                }}
                className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3 py-1.5 text-slate-700 hover:border-[#FD1843] hover:text-[#FD1843] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-xs"
              >
                <span>{q.icon}</span>
                <span>{q.question}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Questions & Answers Conversation Stream */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#FD1843]" />
            <h3 className="text-sm font-mono font-bold text-slate-900 uppercase tracking-wider">
              Answers for Uploaded Image
            </h3>
            <span className="rounded bg-[#FD1843]/10 px-2 py-0.5 text-[11px] font-mono text-[#FD1843] border border-[#FD1843]/20 font-semibold">
              {displayedHistory.length} Answered
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer hover:text-slate-900">
              <input
                type="checkbox"
                checked={filterByCurrentImage}
                onChange={(e) => setFilterByCurrentImage(e.target.checked)}
                className="rounded border-[#eeddd3] bg-white text-[#FD1843] focus:ring-0"
              />
              <span>Filter by current image</span>
            </label>

            {qaHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1"
                title="Clear Question History"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Loading Indicator for Pending Question */}
        {loading && (
          <div className="rounded-2xl border border-[#FD1843]/30 bg-white p-5 space-y-3 animate-pulse shadow-xs">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#FD1843]/10 p-2 text-[#FD1843]">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <p className="text-xs font-mono text-[#FD1843] font-semibold">
                  Executing Agentic VQA Pipeline...
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Sequencing QueryUnderstandingAgent, RemoteSensingVisionAgent (RSVQA), and ExplanationAgent...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Q&A Cards List */}
        {displayedHistory.length === 0 && !loading ? (
          <div className="rounded-2xl border border-dashed border-[#eeddd3] bg-white p-10 text-center space-y-3 shadow-xs">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#FD1843]/10 flex items-center justify-center text-[#FD1843] border border-[#FD1843]/20">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 font-mono">
              No questions asked yet for this image
            </h4>
            <p className="text-xs text-slate-500 font-mono max-w-md mx-auto">
              Type any question about resolution, sensor specs, water bodies, vegetation health, buildings, or land cover in the bar above. The AI assistant will provide evidence-grounded answers.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => handleExecuteQuery('Describe this scene and primary land-cover classes')}
                className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3 py-1.5 text-xs font-mono text-slate-700 hover:border-[#FD1843] hover:text-[#FD1843]"
              >
                🌍 "Describe this scene"
              </button>
              <button
                type="button"
                onClick={() => handleExecuteQuery('Are there any water bodies or lakes in this image?')}
                className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3 py-1.5 text-xs font-mono text-slate-700 hover:border-[#FD1843] hover:text-[#FD1843]"
              >
                💧 "Are there water bodies?"
              </button>
              <button
                type="button"
                onClick={() => handleExecuteQuery('What satellite took this and what is the ground resolution?')}
                className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3 py-1.5 text-xs font-mono text-slate-700 hover:border-[#FD1843] hover:text-[#FD1843]"
              >
                🛰️ "What is the resolution?"
              </button>
            </div>
          </div>
        ) : (
          displayedHistory.map((item, index) => {
            const directAnswerText =
              item.session.result.directAnswer ||
              item.session.result.summary;
            const followups = item.session.result.suggestedFollowups || [];

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-[#eeddd3] bg-white overflow-hidden shadow-xs space-y-0 transition-all hover:border-[#FD1843]/40"
              >
                {/* 1. User Question Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FFF9F4] px-5 py-3.5 border-b border-[#eeddd3]">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-[#FD1843]/10 p-1.5 text-[#FD1843] border border-[#FD1843]/20">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                        Question #{displayedHistory.length - index} • {item.timestamp}
                      </span>
                      <p className="text-sm font-semibold text-slate-900 font-mono">
                        {item.question}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-[#FD1843]/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-[#FD1843] border border-[#FD1843]/20">
                      {item.session.analysis_type}
                    </span>
                    <ConfidenceBadge confidence={item.session.confidence} />
                    <button
                      type="button"
                      onClick={() => setDeleteQAId(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-[#FFF9F4] hover:text-rose-600 transition-colors ml-1"
                      title="Delete this Q&A entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 2. AI Assistant Direct Answer Callout */}
                <div className="p-5 space-y-4">
                  {item.session.result.isValidSatellite === false ? (
                    <div className="rounded-xl border border-rose-500/50 bg-rose-950/30 p-4 space-y-2.5 shadow-inner">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
                            <AlertCircle className="w-4 h-4 text-rose-400" />
                            Image Validation Rejection
                          </span>
                          <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-mono text-rose-300 border border-rose-500/40">
                            Non-Satellite Image
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-sans leading-relaxed text-rose-200 font-normal">
                        {directAnswerText}
                      </p>
                      <div className="mt-2 text-xs font-mono text-rose-300/80 bg-rose-900/30 px-3 py-2 rounded-lg border border-rose-500/20 flex items-center gap-2">
                        <span>👉 Please submit a valid satellite image (e.g. Sentinel-2, Landsat, PlanetScope, aerial orthomosaics) to perform remote sensing analysis.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#FD1843]/30 bg-[#FFF9F4] p-4 space-y-2 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#FD1843] flex items-center gap-1.5 uppercase tracking-wider">
                            <Bot className="w-4 h-4 text-[#FD1843]" />
                            {item.session.result.workingAssistant || 'Geospatial AI Assistant'}:
                          </span>
                          {item.session.result.assistantRole && (
                            <span className="rounded bg-white px-2 py-0.5 text-[10px] font-mono text-slate-700 border border-[#eeddd3]">
                              {item.session.result.assistantRole}
                            </span>
                          )}
                          <span className="rounded bg-[#FD1843]/10 px-2 py-0.5 text-[10px] font-mono text-[#FD1843] border border-[#FD1843]/20 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {item.session.result.autoSwitchedModel
                              ? `OpenRouter Auto-Switch: ${item.session.result.autoSwitchedModel}`
                              : item.session.result.llmModel || 'Deterministic image analysis'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyAnswer(item.id, directAnswerText)}
                          className="text-[11px] font-mono text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-white px-2 py-1 rounded border border-[#eeddd3]"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700 font-semibold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-sm font-sans leading-relaxed text-slate-800 font-normal">
                        {directAnswerText}
                      </p>
                      {item.session.result.imageAnalysis && (
                        <div className="mt-3 border-t border-[#eeddd3] pt-3">
                          {item.session.result.imageAnalysis.overlays.land_cover && (
                            <img
                              src={item.session.result.imageAnalysis.overlays.land_cover}
                              alt="Image-derived land-cover analysis overlay"
                              className="max-h-56 max-w-full rounded-lg border border-[#eeddd3]"
                            />
                          )}
                          <p className="mt-2 text-[10px] font-mono text-slate-500">
                            {item.session.result.imageAnalysis.image_type.toUpperCase()} •{' '}
                            {item.session.result.imageAnalysis.method} •{' '}
                            {item.session.result.imageAnalysis.valid_pixel_count.toLocaleString()} analyzed pixels
                          </p>
                          {item.session.result.imageAnalysis.georeferencing?.available === false && (
                            <p className="mt-1 text-[10px] font-mono text-slate-500">
                              Geographic placement is unavailable for this image.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Detected Targets & Spatial Detections if present */}
                  {item.session.result.detections && item.session.result.detections.length > 0 && (
                    <div className="rounded-xl border border-[#eeddd3] bg-[#FFF9F4] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-[#FD1843] uppercase tracking-wider flex items-center gap-1.5">
                          <Eye className="w-4 h-4" />
                          Measured Region Envelopes ({item.session.result.detections.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onCurrentSessionChange(item.session);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="text-[11px] font-mono text-[#FD1843] hover:text-[#e01239] underline flex items-center gap-1 font-semibold"
                        >
                          <Maximize2 className="w-3 h-3" />
                          Show On Map Above
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {item.session.result.detections.map((det) => (
                          <div
                            key={det.id}
                            className="rounded-lg border border-[#eeddd3] bg-white p-2.5 text-xs font-mono flex items-center justify-between"
                          >
                            <div className="truncate mr-2">
                              <p className="font-semibold text-slate-900 truncate">{det.label}</p>
                              <span className="text-[10px] text-slate-500">{det.category}</span>
                            </div>
                            {typeof det.confidence === 'number' && Number.isFinite(det.confidence) && (
                              <span className="rounded bg-[#FD1843]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#FD1843] shrink-0 border border-[#FD1843]/20">
                                {(det.confidence * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                    {/* 4. Scientific Evidence & Spectral Telemetry Bar */}
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-600">
                      <span className="text-slate-500 font-semibold">Evidence:</span>
                      {item.session.result.statistics?.vegetationPercentage !== undefined
                        && /vegetat|forest|tree|canopy|crop|agricultur|land.cover|analy[sz]e|overview/i.test(item.question) && (
                        <span className="rounded bg-[#FFF9F4] px-2.5 py-1 border border-[#eeddd3] text-emerald-700 font-semibold">
                          Veg: {item.session.result.statistics.vegetationPercentage}%
                        </span>
                      )}
                      {item.session.result.statistics?.waterPercentage !== undefined
                        && /water|flood|land.cover|land\/water|analy[sz]e|overview/i.test(item.question) && (
                        <span className="rounded bg-[#FFF9F4] px-2.5 py-1 border border-[#eeddd3] text-[#FD1843] font-semibold">
                          Water: {item.session.result.statistics.waterPercentage}%
                        </span>
                      )}
                      {item.session.result.statistics?.builtUpPercentage !== undefined
                        && /built|urban|building|land.cover|analy[sz]e|overview/i.test(item.question) && (
                        <span className="rounded bg-[#FFF9F4] px-2.5 py-1 border border-[#eeddd3] text-amber-700 font-semibold">
                          Built-up: {item.session.result.statistics.builtUpPercentage}%
                        </span>
                      )}
                      {item.session.result.statistics?.bareSoilPercentage !== undefined
                        && /land.cover|land\/water|analy[sz]e|overview/i.test(item.question) && (
                        <span className="rounded bg-[#FFF9F4] px-2.5 py-1 border border-[#eeddd3] text-amber-800">
                          Soil: {item.session.result.statistics.bareSoilPercentage}%
                        </span>
                      )}
                      {item.session.result.statistics?.meanIndex !== undefined
                        && /ndvi|vegetat|forest|tree|canopy|crop|agricultur/i.test(item.question) && (
                        <span className="rounded bg-[#FFF9F4] px-2.5 py-1 border border-[#eeddd3] text-slate-800 font-semibold">
                          Mean Index: {item.session.result.statistics.meanIndex > 0 ? '+' : ''}{item.session.result.statistics.meanIndex.toFixed(3)}
                        </span>
                      )}
                      <span className="rounded bg-[#FFF9F4] px-2.5 py-1 border border-[#eeddd3] text-slate-700">
                        Sensor: {item.imageSatellite}
                      </span>
                    </div>

                  {/* 5. Key Findings & Recommendations */}
                  {item.session.result.keyTakeaways && item.session.result.keyTakeaways.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-600 block">
                        Domain Findings:
                      </span>
                      <ul className="space-y-1 text-xs text-slate-700 font-mono">
                        {item.session.result.keyTakeaways.map((takeaway, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-[#FD1843] shrink-0">▸</span>
                            <span>{takeaway}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 6. One-Click Suggested Follow-Up Questions */}
                  {followups.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-[#eeddd3]">
                      <span className="text-[11px] font-mono text-slate-600 flex items-center gap-1 font-semibold">
                        <Sparkles className="w-3 h-3 text-[#FD1843]" />
                        Suggested Follow-Up Questions:
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {followups.map((fq, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleExecuteQuery(fq)}
                            className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-2.5 py-1 text-xs font-mono text-[#FD1843] hover:border-[#FD1843] hover:bg-white transition-colors"
                          >
                            {fq} →
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 7. Action Bar & Expandable Technical Details */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#eeddd3]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveQuery(item)}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition-colors ${
                          savedSuccess === item.id
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-[#eeddd3] bg-white text-slate-700 hover:text-slate-900 hover:bg-[#FFF9F4]'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>{savedSuccess === item.id ? 'Saved' : 'Save Query'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportJSON(item.session)}
                        className="flex items-center gap-1.5 rounded-lg border border-[#eeddd3] bg-white px-2.5 py-1 text-xs font-mono text-slate-700 hover:text-slate-900 hover:bg-[#FFF9F4] transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export JSON</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => analysisService.downloadReport(item.session.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-[#FD1843]/30 bg-[#FD1843]/10 px-2.5 py-1 text-xs font-mono text-[#FD1843] hover:bg-[#FD1843]/20 font-semibold transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#FD1843]" />
                        <span>Download Report</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpandQA(item.id)}
                      className="text-xs font-mono text-slate-500 hover:text-slate-900 flex items-center gap-1"
                    >
                      <span>{item.expandedDetails ? 'Hide Deep Inspection' : 'Deep Technical Trace'}</span>
                      {item.expandedDetails ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* 8. Collapsible Detailed Agentic Trace & Dynamics */}
                  {item.expandedDetails && (
                    <div className="space-y-4 pt-3 border-t border-[#eeddd3]">
                      {item.session.result.executionTrace && (
                        <AgenticTraceViewer
                          trace={item.session.result.executionTrace}
                          auditableSummary={item.session.result.auditableSummary}
                          modelsExecuted={item.session.result.modelsExecuted}
                          agentsExecuted={item.session.result.agentsExecuted}
                          totalLatencyMs={item.session.result.totalLatencyMs}
                        />
                      )}

                      {/* Bi-Temporal Dynamics if present */}
                      {item.session.result.changeMetrics && (
                        <div className="rounded-xl border border-[#eeddd3] bg-[#FFF9F4] p-4 space-y-3 font-mono">
                          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4" />
                            Bi-Temporal Dynamics (CDVQA Benchmark)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded bg-white p-2.5 border border-[#eeddd3]">
                              <span className="text-[10px] text-slate-500 uppercase block">Built-Up Expansion</span>
                              <span className="text-base font-bold text-slate-900">
                                +{item.session.result.changeMetrics.built_up?.delta_km2} km² (+{item.session.result.changeMetrics.built_up?.percentage_change}%)
                              </span>
                            </div>
                            <div className="rounded bg-white p-2.5 border border-[#eeddd3]">
                              <span className="text-[10px] text-slate-500 uppercase block">Vegetation Canopy</span>
                              <span className="text-base font-bold text-slate-900">
                                {item.session.result.changeMetrics.vegetation?.delta_km2} km² ({item.session.result.changeMetrics.vegetation?.percentage_change}%)
                              </span>
                            </div>
                            <div className="rounded bg-white p-2.5 border border-[#eeddd3]">
                              <span className="text-[10px] text-slate-500 uppercase block">Water Dynamics</span>
                              <span className="text-base font-bold text-slate-900">
                                {item.session.result.changeMetrics.water_body?.delta_km2} km² ({item.session.result.changeMetrics.water_body?.percentage_change}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={questionsEndRef} />
      </div>

      {/* Evaluation & Judging Criteria Modal */}
      <EvaluationCriteriaModal
        isOpen={evalModalOpen}
        onClose={() => setEvalModalOpen(false)}
      />

      {/* BigEarthNet Multimodal Evaluation Modal */}
      <BigEarthNetEvaluationModal
        isOpen={bigEarthNetModalOpen}
        onClose={() => setBigEarthNetModalOpen(false)}
        activeImage={activeImg}
        onApplyVqaQuestion={(q) => {
          setQuery(q);
          handleExecuteQuery(q);
        }}
      />

      {/* Upload Satellite Scene Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-[#eeddd3] bg-white p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setUploadModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-[#FFF9F4] hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900 font-mono flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-emerald-600" />
                <span>Upload Supported Satellite Scene</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Upload GeoTIFF, TIFF, PNG, or JPEG scenes (Sentinel-2, Landsat-9, Cartosat, or SAR) for automated agentic processing and Q&A.
              </p>
            </div>
            <ImageUploader
              projects={projects}
              activeProjectId={activeProject?.id}
              onSuccess={(newImg) => {
                onImageUploaded?.(newImg);
                onSelectImage(newImg);
                setUploadModalOpen(false);
              }}
              onCancel={() => setUploadModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Confirmation Modal for Single Q&A Entry Deletion */}
      <ConfirmModal
        isOpen={Boolean(deleteQAId)}
        title="Delete Q&A Result"
        message="Are you sure you want to remove this answer and technical trace from the session history?"
        confirmLabel="Delete Entry"
        onConfirm={() => {
          if (deleteQAId) handleDeleteQAItem(deleteQAId);
        }}
        onCancel={() => setDeleteQAId(null)}
      />

      {/* Confirmation Modal for Clearing All Q&A History */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear All Q&A History"
        message="Are you sure you want to clear all answered questions for this session? This action cannot be undone."
        confirmLabel="Clear All"
        onConfirm={handleClearQAHistory}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
};
