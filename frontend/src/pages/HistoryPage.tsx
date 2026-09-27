import React, { useState } from 'react';
import { History, Search, Filter, Bot, Calendar, Download, Eye, X } from 'lucide-react';
import { AnalysisSession, AnalysisType } from '../types/index.js';
import { ConfidenceBadge } from '../components/ConfidenceBadge.js';
import { SpectralChart } from '../components/SpectralChart.js';

interface HistoryPageProps {
  sessions: AnalysisSession[];
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ sessions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [activeSession, setActiveSession] = useState<AnalysisSession | null>(null);

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.result.summary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'ALL' || s.analysis_type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-[#eeddd3] bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#FD1843]/10 p-2.5 text-[#FD1843] border border-[#FD1843]/30">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 font-mono">
              Earth Observation Analysis Archive
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical record of all multimodal AI runs, spectral calculations, and detections
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-[#eeddd3] bg-white p-3.5 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search queries and findings..."
            className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-[#FD1843] focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-600 font-semibold">Analysis Type:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#FD1843] focus:outline-none"
          >
            <option value="ALL">All Analysis Types</option>
            <option value="VEGETATION">Vegetation (NDVI)</option>
            <option value="WATER_DETECTION">Water Bodies (NDWI)</option>
            <option value="OBJECT_DETECTION">Object Detection</option>
            <option value="BUILT_UP_ANALYSIS">Built-up (NDBI)</option>
            <option value="CHANGE_DETECTION">Change Detection</option>
            <option value="IMAGE_DESCRIPTION">Scene Description</option>
          </select>
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {filteredSessions.map((session) => (
          <div
            key={session.id}
            onClick={() => setActiveSession(session)}
            className="rounded-xl border border-[#eeddd3] bg-white p-4 transition-all hover:border-[#FD1843]/40 hover:bg-[#FFF9F4]/50 cursor-pointer space-y-3 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eeddd3] pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#FD1843]/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#FD1843] border border-[#FD1843]/20">
                  {session.analysis_type}
                </span>
                <ConfidenceBadge confidence={session.confidence} />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(session.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-mono font-medium text-[#FD1843]">
                Query: "{session.query}"
              </p>
              <p className="mt-1.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {session.result.summary}
              </p>
            </div>

            {/* Quick Metrics Bar */}
            {session.result.statistics && (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono text-slate-500">
                {session.result.statistics.vegetationPercentage !== undefined && (
                  <span>Veg: {session.result.statistics.vegetationPercentage}%</span>
                )}
                {session.result.statistics.waterPercentage !== undefined && (
                  <span>Water: {session.result.statistics.waterPercentage}%</span>
                )}
                {session.result.statistics.builtUpPercentage !== undefined && (
                  <span>Built-up: {session.result.statistics.builtUpPercentage}%</span>
                )}
                {session.result.detections?.length > 0 && (
                  <span className="text-emerald-700 font-semibold">
                    {session.result.detections.length} discrete targets localized
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {filteredSessions.length === 0 && (
          <div className="rounded-xl border border-[#eeddd3] bg-white p-8 text-center text-xs font-mono text-slate-500 shadow-xs">
            No analysis sessions match your search criteria.
          </div>
        )}
      </div>

      {/* Detailed Inspection Modal */}
      {activeSession && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#eeddd3] bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#eeddd3] pb-4">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-[#FD1843]/10 px-2.5 py-1 text-xs font-mono font-bold text-[#FD1843] border border-[#FD1843]/30">
                  {activeSession.analysis_type}
                </span>
                <ConfidenceBadge confidence={activeSession.confidence} />
              </div>
              <button
                type="button"
                onClick={() => setActiveSession(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-[#FFF9F4] hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl bg-[#FFF9F4] p-4 border border-[#eeddd3]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#FD1843] font-bold">Prompt</span>
              <p className="mt-1 text-sm font-medium text-slate-900">"{activeSession.query}"</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-600">
                Earth Observation Interpretation
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">{activeSession.result.summary}</p>
            </div>

            {activeSession.result.statistics && (
              <SpectralChart
                statistics={activeSession.result.statistics}
                indexName={activeSession.result.spectralInterpretation?.indexName || 'Spectral Metrics'}
                formula={activeSession.result.spectralInterpretation?.formula}
              />
            )}

            {activeSession.result.recommendations && (
              <div className="rounded-xl bg-[#FFF9F4] p-4 border border-[#eeddd3] space-y-2">
                <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-700">
                  Scientific Recommendations
                </h4>
                <ul className="space-y-1 text-xs text-slate-700 font-mono">
                  {activeSession.result.recommendations.map((rec, i) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
