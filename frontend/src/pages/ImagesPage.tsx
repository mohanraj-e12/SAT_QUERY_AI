import React, { useState } from 'react';
import {
  FileImage,
  UploadCloud,
  Search,
  Bot,
  Compass,
  Trash2,
  Calendar,
  Layers,
  MapPin,
} from 'lucide-react';
import { SatelliteImage, Project } from '../types/index.js';
import { ImageUploader } from '../components/ImageUploader.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { imageService } from '../services/image.service.js';

interface ImagesPageProps {
  images: SatelliteImage[];
  projects: Project[];
  activeProject: Project | null;
  onSelectImageForAssistant: (image: SatelliteImage) => void;
  onSelectImageForMap: (image: SatelliteImage) => void;
  onImageUploaded: (image: SatelliteImage) => void;
  onImageDeleted: (id: string) => void;
}

export const ImagesPage: React.FC<ImagesPageProps> = ({
  images,
  projects,
  activeProject,
  onSelectImageForAssistant,
  onSelectImageForMap,
  onImageUploaded,
  onImageDeleted,
}) => {
  const [showUploader, setShowUploader] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [satelliteFilter, setSatelliteFilter] = useState('ALL');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredImages = images.filter((img) => {
    const matchesSearch =
      img.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      img.satellite.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSat =
      satelliteFilter === 'ALL' || img.satellite.toLowerCase().includes(satelliteFilter.toLowerCase());
    return matchesSearch && matchesSat;
  });

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await imageService.deleteImage(deleteTargetId);
      onImageDeleted(deleteTargetId);
    } catch (err) {
      console.warn('Failed to delete scene:', err);
      // Still notify parent state so UI updates if deleted locally
      onImageDeleted(deleteTargetId);
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-[#eeddd3] bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#FD1843]/10 p-2.5 text-[#FD1843] border border-[#FD1843]/30">
            <FileImage className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 font-mono">
              Satellite Imagery Catalog & Sensor Data
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Multispectral acquisitions, GeoTIFF orthos, and spatial band archives
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowUploader(true)}
          className="flex items-center gap-2 rounded-lg bg-[#FD1843] px-4 py-2 text-xs font-mono font-semibold text-white hover:bg-[#e01239] shadow-md shadow-[#FD1843]/20 transition-all"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Ingest New Scene</span>
        </button>
      </div>

      {/* Upload Modal Drawer */}
      {showUploader && (
        <div className="rounded-2xl border border-[#eeddd3] bg-white p-6 shadow-2xl">
          <ImageUploader
            projects={projects}
            activeProjectId={activeProject?.id}
            onSuccess={(img) => {
              onImageUploaded(img);
              setShowUploader(false);
            }}
            onCancel={() => setShowUploader(false)}
          />
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-[#eeddd3] bg-white p-3.5 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search scenes by filename, sensor, or mission..."
            className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-[#FD1843] focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-600 font-semibold">Mission:</span>
          <select
            value={satelliteFilter}
            onChange={(e) => setSatelliteFilter(e.target.value)}
            className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#FD1843] focus:outline-none"
          >
            <option value="ALL">All Constellations</option>
            <option value="Sentinel-2">Copernicus Sentinel-2</option>
            <option value="Landsat-9">USGS Landsat-9</option>
            <option value="Resourcesat">ISRO Resourcesat</option>
          </select>
        </div>
      </div>

      {/* Images Grid or Empty State */}
      {filteredImages.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#eeddd3] p-12 text-center bg-white shadow-xs">
          <FileImage className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-mono font-bold text-slate-900 mb-1">
            No Satellite Imagery Cataloged
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
            The platform is running in a clean state with no inbuilt data. Upload your GeoTIFF, TIFF, JPG, or PNG satellite scene to begin analyzing.
          </p>
          <button
            type="button"
            onClick={() => setShowUploader(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FD1843] px-4 py-2 text-xs font-mono font-bold text-white hover:bg-[#e01239] transition-all shadow-md shadow-[#FD1843]/20"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Ingest Satellite Scene</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredImages.map((img) => (
          <div
            key={img.id}
            className="overflow-hidden rounded-2xl border border-[#eeddd3] bg-white transition-all hover:border-[#FD1843]/40 flex flex-col justify-between shadow-xs"
          >
            <div>
              {/* Scene Thumbnail */}
              <div className="relative aspect-video w-full overflow-hidden bg-[#FFF9F4] border-b border-[#eeddd3]">
                <img
                  src={img.file_url}
                  alt={img.file_name}
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                />
                <div className="absolute top-2.5 left-2.5 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#FD1843] border border-[#eeddd3] backdrop-blur-md">
                  {img.satellite}
                </div>
                <div className="absolute top-2.5 right-2.5 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-mono text-slate-700 border border-[#eeddd3] backdrop-blur-md">
                  Res: {img.resolution_meters != null ? `${img.resolution_meters}m` : 'Unavailable'}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="text-xs font-mono font-bold text-slate-900 truncate" title={img.file_name}>
                    {img.file_name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-[11px] font-mono text-slate-500">
                    <Calendar className="w-3 h-3 text-[#FD1843]" />
                    <span>Acquired: {img.acquisition_date || 'Unavailable'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-600 bg-[#FFF9F4] p-2.5 rounded-lg border border-[#eeddd3]">
                  <div>
                    <span className="text-slate-500">Cloud Cover:</span>
                    <p className="text-slate-900 font-medium">
                      {img.cloud_percentage != null ? `${img.cloud_percentage}%` : 'Unavailable'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Sensor:</span>
                    <p className="text-slate-900 font-medium truncate">{img.sensor || 'Unavailable'}</p>
                  </div>
                </div>

                {/* Bands Tag Row */}
                <div className="flex flex-wrap gap-1">
                  {img.bands.slice(0, 4).map((band, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-[#FFF9F4] px-1.5 py-0.5 text-[9px] font-mono text-slate-700 border border-[#eeddd3]"
                    >
                      {band}
                    </span>
                  ))}
                  {img.bands.length > 4 && (
                    <span className="text-[9px] font-mono text-slate-500 self-center">
                      +{img.bands.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="border-t border-[#eeddd3] p-3 bg-[#FFF9F4] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelectImageForAssistant(img)}
                  className="flex items-center gap-1 rounded-lg bg-[#FD1843]/10 px-2.5 py-1.5 text-xs font-mono font-semibold text-[#FD1843] border border-[#FD1843]/30 hover:bg-[#FD1843] hover:text-white transition-colors"
                  title="Query with Vision-Language Assistant"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Assistant</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectImageForMap(img)}
                  className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-mono text-slate-700 border border-[#eeddd3] hover:bg-[#FFF9F4] transition-colors"
                  title="View on Interactive Map"
                >
                  <Compass className="w-3.5 h-3.5 text-[#FD1843]" />
                  <span>Map</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDeleteTargetId(img.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-rose-600 transition-colors"
                title="Remove Scene"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="Delete Satellite Scene"
        message="Are you sure you want to remove this satellite scene from the catalog? This operation will remove the cached multispectral bands and any associated analysis sessions."
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Scene'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
