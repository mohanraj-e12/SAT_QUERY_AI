import React, { useState } from 'react';
import { FolderPlus, X, MapPin } from 'lucide-react';
import { Project } from '../types/index.js';
import { projectService } from '../services/project.service.js';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('Sentinel-2, Environmental Monitoring');
  const [aoiPreset, setAoiPreset] = useState<'delhi' | 'bangalore' | 'mumbai' | 'custom'>('delhi');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    // Preset AOI Polygons
    let aoiCoordinates = [
      [
        [77.10, 28.50],
        [77.30, 28.50],
        [77.30, 28.75],
        [77.10, 28.75],
        [77.10, 28.50],
      ],
    ];

    if (aoiPreset === 'bangalore') {
      aoiCoordinates = [
        [
          [77.45, 12.85],
          [77.75, 12.85],
          [77.75, 13.15],
          [77.45, 13.15],
          [77.45, 12.85],
        ],
      ];
    } else if (aoiPreset === 'mumbai') {
      aoiCoordinates = [
        [
          [72.75, 18.90],
          [73.05, 18.90],
          [73.05, 19.25],
          [72.75, 19.25],
          [72.75, 18.90],
        ],
      ];
    }

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const created = await projectService.createProject({
        name,
        description,
        tags,
        aoi: {
          type: 'Polygon',
          coordinates: aoiCoordinates,
        },
      });

      setLoading(false);
      onCreated(created);
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to initialize project workspace.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[#eeddd3] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#eeddd3] pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#FD1843]/10 p-2 text-[#FD1843] border border-[#FD1843]/20">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Create Geospatial Project</h3>
              <p className="text-xs text-slate-500">Initialize a dedicated observation catalog & AOI boundary</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-[#FD1843]/10 hover:text-[#FD1843] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-slate-700 mb-1.5">
              Project Title *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Delhi NCR Urban Heat & Green Cover Monitor"
              className="w-full rounded-lg border border-[#eeddd3] bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#FD1843] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-700 mb-1.5">
              Description & Objectives
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail monitoring objectives, expected sensor types, and mission mandates..."
              className="w-full rounded-lg border border-[#eeddd3] bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#FD1843] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-700 mb-1.5">
              Area of Interest (AOI) Preset
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'delhi', label: 'Delhi NCR' },
                { id: 'bangalore', label: 'Bengaluru Tech Corridor' },
                { id: 'mumbai', label: 'Mumbai Coastal Zone' },
              ].map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setAoiPreset(loc.id as any)}
                  className={`px-3 py-2 rounded-lg text-xs font-mono border transition-all text-left ${
                    aoiPreset === loc.id
                      ? 'border-[#FD1843] bg-[#FD1843]/10 text-[#FD1843] font-semibold'
                      : 'border-[#eeddd3] bg-[#FFF9F4] text-slate-700 hover:border-[#FD1843]/30'
                  }`}
                >
                  <MapPin className="w-3 h-3 mb-1" />
                  <span className="block truncate">{loc.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-700 mb-1.5">
              Tags (Comma separated)
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Sentinel-2, NDVI, Urban Expansion"
              className="w-full rounded-lg border border-[#eeddd3] bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-[#FD1843] focus:outline-none font-mono"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#eeddd3]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#eeddd3] bg-white text-xs font-medium text-slate-700 hover:bg-[#FFF9F4]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-[#FD1843] text-xs font-semibold text-white hover:bg-[#e01239] transition-colors shadow-lg shadow-[#FD1843]/20 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
