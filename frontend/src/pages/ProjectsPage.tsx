import React, { useState } from 'react';
import { FolderKanban, Plus, MapPin, Calendar, Tag, Check, Trash2 } from 'lucide-react';
import { Project } from '../types/index.js';
import { NewProjectModal } from '../components/NewProjectModal.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { projectService } from '../services/project.service.js';

interface ProjectsPageProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (project: Project | null) => void;
  onProjectCreated: (project: Project) => void;
  onProjectDeleted: (id: string) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onProjectCreated,
  onProjectDeleted,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await projectService.deleteProject(deleteTargetId);
      onProjectDeleted(deleteTargetId);
    } catch (err) {
      console.warn('Failed to delete project:', err);
      onProjectDeleted(deleteTargetId);
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
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 font-mono">
              Geospatial Project Workspaces & AOIs
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Organize satellite imagery acquisitions, bounding polygons, and multi-temporal runs
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[#FD1843] px-4 py-2 text-xs font-mono font-semibold text-white hover:bg-[#e0143a] shadow-md shadow-[#FD1843]/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Project Workspace</span>
        </button>
      </div>

      {/* Projects Grid or Empty State */}
      {projects.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#eeddd3] p-12 text-center bg-white shadow-xs">
          <FolderKanban className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-mono font-bold text-slate-900 mb-1">
            No Project Workspaces Configured
          </h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto mb-5 leading-relaxed">
            Create an Area of Interest (AOI) project workspace to isolate satellite imagery acquisitions, bounding polygons, and multi-temporal runs.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FD1843] px-4 py-2 text-xs font-mono font-bold text-white hover:bg-[#e0143a] transition-all shadow-md shadow-[#FD1843]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Project Workspace</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
          const isActive = activeProject?.id === project.id;
          return (
            <div
              key={project.id}
              onClick={() => onSelectProject(isActive ? null : project)}
              className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all cursor-pointer shadow-xs ${
                isActive
                  ? 'border-[#FD1843] bg-white ring-2 ring-[#FD1843]/20 shadow-md shadow-[#FD1843]/10'
                  : 'border-[#eeddd3] bg-white hover:border-[#FD1843]/50 hover:shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-mono text-sm font-bold text-slate-900 leading-snug">
                    {project.name}
                  </h3>
                  {isActive && (
                    <span className="flex items-center gap-1 rounded bg-[#FD1843]/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#FD1843] border border-[#FD1843]/30 shrink-0">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {project.description || 'No description provided.'}
                </p>

                {/* AOI Details */}
                <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-[#FD1843] shrink-0" />
                  <span>
                    AOI Polygon:{' '}
                    {project.aoi ? 'Designated GeoJSON Boundary' : 'Unbounded (Global)'}
                  </span>
                </div>

                {/* Tags */}
                {project.tags && project.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {project.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="rounded bg-[#FFF9F4] px-2 py-0.5 font-mono text-[10px] text-slate-700 border border-[#eeddd3]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Meta & Actions */}
              <div className="mt-5 flex items-center justify-between border-t border-[#eeddd3] pt-3 text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1 text-slate-500">
                  <Calendar className="w-3 h-3" />
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTargetId(project.id);
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Delete Project"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      <NewProjectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(p) => {
          onProjectCreated(p);
          onSelectProject(p);
        }}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="Delete Project Workspace"
        message="Are you sure you want to delete this project workspace? All associated analyses and project queries will be removed."
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Project'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
