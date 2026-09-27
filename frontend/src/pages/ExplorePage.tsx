import React, { useState, useEffect } from 'react';
import {
  Compass,
  Layers,
  Bot,
  Filter,
  Eye,
  Activity,
  Maximize2,
  Calendar,
  Crosshair,
  RefreshCw,
} from 'lucide-react';
import { SatelliteImage, Project, SpectralStatistics } from '../types/index.js';
import { MapViewer } from '../components/MapViewer.js';
import { SpectralChart } from '../components/SpectralChart.js';
import { extractRealPixelSpectralStats } from '../utils/imagePixelAnalyzer.js';

interface ExplorePageProps {
  images: SatelliteImage[];
  activeProject: Project | null;
  onSelectImageForAssistant: (image: SatelliteImage) => void;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({
  images,
  activeProject,
  onSelectImageForAssistant,
}) => {
  const [selectedImageId, setSelectedImageId] = useState<string>(images[0]?.id || '');
  const [spectralMask, setSpectralMask] = useState<'none' | 'NDVI' | 'NDWI' | 'NDBI'>('none');
  const [analyzedStats, setAnalyzedStats] = useState<SpectralStatistics | null>(null);
  const [analyzingImage, setAnalyzingImage] = useState<boolean>(false);

  const selectedImage = images.find((i) => i.id === selectedImageId) || images[0];

  // Dynamically extract real pixel spectral statistics whenever the active image or spectral mask changes
  useEffect(() => {
    let isMounted = true;
    if (!selectedImage?.file_url) {
      setAnalyzedStats(null);
      return;
    }

    setAnalyzingImage(true);
    extractRealPixelSpectralStats(selectedImage.file_url, spectralMask)
      .then((stats) => {
        if (isMounted) {
          setAnalyzedStats(stats);
          setAnalyzingImage(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAnalyzingImage(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedImage?.file_url, spectralMask]);

  const indexName =
    spectralMask === 'NDWI'
      ? 'RGB Water-Color Estimate'
      : spectralMask === 'NDBI'
      ? 'RGB Built-up Color Estimate'
      : 'RGB Visible-Greenness Estimate';
  const formula =
    spectralMask === 'NDWI'
      ? 'RGB color heuristic only; not NDWI (requires spectral green and NIR bands)'
      : spectralMask === 'NDBI'
      ? 'RGB color heuristic only; not NDBI (requires spectral SWIR and NIR bands)'
      : 'Visible RGB greenness proxy only; not NDVI (requires red and NIR bands)';

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header & Scene Selector */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-[#eeddd3] bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#FD1843]/10 p-2 text-[#FD1843] border border-[#FD1843]/20">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 font-mono">
              Geospatial Map Explorer & AOI Telemetry
            </h1>
            <p className="text-xs text-slate-500">
              {activeProject ? `Project AOI: ${activeProject.name}` : 'Interactive Multi-Mission Earth Observation Stage'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Select Scene */}
          <div className="flex items-center gap-2 rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3 py-1.5 text-xs shadow-xs">
            <span className="text-slate-500 font-mono">Active Scene:</span>
            <select
              value={selectedImage?.id || ''}
              onChange={(e) => setSelectedImageId(e.target.value)}
              className="bg-transparent font-mono text-slate-900 focus:outline-none cursor-pointer max-w-[220px] truncate"
            >
              {images.map((img) => (
                <option key={img.id} value={img.id} className="bg-white text-slate-900">
                  {img.file_name} ({img.satellite})
                </option>
              ))}
            </select>
          </div>

          {/* Assistant Action */}
          {selectedImage && (
            <button
              type="button"
              onClick={() => onSelectImageForAssistant(selectedImage)}
              className="flex items-center gap-1.5 rounded-lg bg-[#FD1843] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#e01239] shadow-lg shadow-[#FD1843]/20 transition-all font-mono"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Query in Assistant</span>
            </button>
          )}
        </div>
      </div>

      {/* Spectral Mask Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eeddd3] bg-white px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-700">
          <Layers className="w-4 h-4 text-[#FD1843]" />
          <span>Spectral Index Mask:</span>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs font-mono">
          {[
            { id: 'none', label: 'True Color (RGB Composite)' },
            { id: 'NDVI', label: 'Visible Greenness (RGB estimate)', color: 'text-emerald-700 border-emerald-300 bg-emerald-50' },
            { id: 'NDWI', label: 'Water Color (RGB estimate)', color: 'text-[#FD1843] border-[#FD1843]/30 bg-[#FD1843]/10' },
            { id: 'NDBI', label: 'Built-up Color (RGB estimate)', color: 'text-amber-700 border-amber-300 bg-amber-50' },
          ].map((mask) => (
            <button
              key={mask.id}
              type="button"
              onClick={() => setSpectralMask(mask.id as any)}
              className={`px-3 py-1 rounded-lg border transition-all ${
                spectralMask === mask.id
                  ? mask.id === 'none'
                    ? 'bg-[#FD1843] text-white border-[#FD1843] font-bold shadow-xs'
                    : `${mask.color} font-bold shadow-xs`
                  : 'bg-[#FFF9F4] border-[#eeddd3] text-slate-600 hover:text-slate-900 hover:border-[#FD1843]/30'
              }`}
            >
              {mask.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map & Telemetry Split View */}
      {images.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#eeddd3] bg-white p-12 text-center shadow-xs">
          <Compass className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h2 className="text-base font-mono font-bold text-slate-900 mb-2">
            No Satellite Imagery Loaded
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            The platform is running without pre-populated demo data. Upload a satellite scene or use the AI Assistant to inspect Earth Observation imagery on the interactive map.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {/* Map Column (3 cols) */}
          <div className="lg:col-span-3">
            <MapViewer
              image={selectedImage}
              aoi={activeProject?.aoi}
              spectralMaskType={spectralMask}
              height="580px"
            />
          </div>

          {/* Telemetry & Metadata Side Column (1 col) */}
          <div className="space-y-4">
            {/* Metadata Card */}
            {selectedImage && (
              <div className="rounded-xl border border-[#eeddd3] bg-white p-4 space-y-3 shadow-xs">
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#FD1843] border-b border-[#eeddd3] pb-2">
                  Scene Telemetry & Payload
                </h3>
                <div className="space-y-2 text-xs font-mono text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mission:</span>
                    <span className="text-slate-900 font-semibold">{selectedImage.satellite}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sensor:</span>
                    <span className="text-slate-800">{selectedImage.sensor || 'MSI Optical'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Acquired:</span>
                    <span className="text-slate-800">{selectedImage.acquisition_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pixel Resolution:</span>
                    <span className="text-[#FD1843] font-semibold">
                      {selectedImage.resolution_meters != null ? `${selectedImage.resolution_meters}m` : 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cloud Fraction:</span>
                    <span className="text-slate-800">
                      {selectedImage.cloud_percentage != null ? `${selectedImage.cloud_percentage}%` : 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Available Bands:</span>
                    <span className="text-[11px] text-slate-600">{selectedImage.bands.join(', ')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Spectral Metrics Chart */}
            <div className="relative">
              {analyzingImage && (
                <div className="absolute inset-0 bg-[#FFF9F4]/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl border border-[#eeddd3]">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#FD1843] font-semibold">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Image Pixels...</span>
                  </div>
                </div>
              )}
              {analyzedStats ? (
                <SpectralChart
                  statistics={analyzedStats}
                  indexName={indexName}
                  formula={formula}
                />
              ) : (
                <div className="p-4 rounded-xl border border-[#eeddd3] bg-white text-center text-xs text-slate-500 font-mono shadow-xs">
                  Extracting spectral pixel distribution for {selectedImage?.file_name}...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
