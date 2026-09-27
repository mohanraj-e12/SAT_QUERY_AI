import React, { useState } from 'react';
import {
  Workflow,
  Cpu,
  CheckCircle2,
  Sliders,
  Database,
  Compass,
  Clock,
  ChevronDown,
  ChevronUp,
  Layers,
  Radio,
  FileCheck,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface AgenticTraceViewerProps {
  trace?: any[];
  auditableSummary?: any;
  modelsExecuted?: string[];
  agentsExecuted?: string[];
  totalLatencyMs?: number;
}

export const AgenticTraceViewer: React.FC<AgenticTraceViewerProps> = ({
  trace,
  auditableSummary,
  modelsExecuted,
  agentsExecuted,
  totalLatencyMs,
}) => {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  if (!trace || trace.length === 0) return null;

  const toggleStep = (stepNum: number) => {
    setExpandedStep(expandedStep === stepNum ? null : stepNum);
  };

  const getStepIcon = (stepNum: number) => {
    switch (stepNum) {
      case 1:
        return <Compass className="w-4 h-4 text-[#FD1843]" />;
      case 2:
        return <FileCheck className="w-4 h-4 text-emerald-600" />;
      case 3:
        return <Cpu className="w-4 h-4 text-[#FD1843]" />;
      case 4:
        return <Sliders className="w-4 h-4 text-amber-600" />;
      case 5:
        return <Zap className="w-4 h-4 text-purple-600" />;
      default:
        return <Workflow className="w-4 h-4 text-[#FD1843]" />;
    }
  };

  return (
    <div className="rounded-xl border border-[#eeddd3] bg-white p-5 space-y-4 font-mono shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeddd3] pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-[#FD1843]/10 p-1.5 text-[#FD1843] border border-[#FD1843]/30">
            <Workflow className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>Auditable Agentic Execution Trace</span>
              <span className="rounded bg-[#FD1843]/10 px-2 py-0.5 text-[10px] text-[#FD1843] border border-[#FD1843]/30 font-semibold">
                5-Stage Pipeline
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 font-sans">
              Autonomous query classification, input verification, registry selection & parameter enforcement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {totalLatencyMs !== undefined && (
            <span className="flex items-center gap-1 rounded bg-[#FFF9F4] px-2.5 py-1 border border-[#eeddd3] text-slate-700">
              <Clock className="w-3.5 h-3.5 text-[#FD1843]" />
              <span>{totalLatencyMs} ms</span>
            </span>
          )}
          {modelsExecuted && modelsExecuted.length > 0 && (
            <span className="flex items-center gap-1 rounded bg-[#FFF9F4] px-2.5 py-1 border border-[#eeddd3] text-emerald-700">
              <Cpu className="w-3.5 h-3.5" />
              <span>{modelsExecuted.length} Models</span>
            </span>
          )}
        </div>
      </div>

      {/* Active Autonomous Agents Pill Bar */}
      {agentsExecuted && agentsExecuted.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="text-slate-500">Active Agents:</span>
          {agentsExecuted.map((a, idx) => (
            <span
              key={idx}
              className="rounded bg-[#FD1843]/10 px-2 py-0.5 text-[#FD1843] border border-[#FD1843]/20 font-medium"
            >
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Selected Models Pill Bar */}
      {modelsExecuted && modelsExecuted.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="text-slate-500">Specialist Models:</span>
          {modelsExecuted.map((m, idx) => (
            <span
              key={idx}
              className="rounded bg-[#FFF9F4] px-2 py-0.5 text-slate-800 border border-[#eeddd3] font-semibold"
            >
              {m}
            </span>
          ))}
        </div>
      )}

      {/* Sequential Steps List */}
      <div className="space-y-2.5">
        {trace.map((item) => {
          const isExpanded = expandedStep === item.step;
          return (
            <div
              key={item.step}
              className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4]/70 overflow-hidden transition-all"
            >
              <button
                type="button"
                onClick={() => toggleStep(item.step)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-white transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-white p-1.5 border border-[#eeddd3]">
                    {getStepIcon(item.step)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500">
                        Step {item.step}:
                      </span>
                      <span className="text-xs font-semibold text-slate-900">
                        {item.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[500px]">
                      {item.action}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {item.duration_ms !== undefined && (
                    <span className="text-[10px] text-slate-500">
                      {item.duration_ms} ms
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </button>

              {/* Collapsible Details */}
              {isExpanded && (
                <div className="border-t border-[#eeddd3] bg-white p-3 text-[11px] text-slate-700 space-y-2">
                  {item.task_classified && (
                    <div>
                      <span className="text-slate-500">Classified Task: </span>
                      <span className="text-[#FD1843] font-bold">{item.task_classified}</span>
                      <p className="text-slate-500 text-[10px] mt-0.5">{item.task_description}</p>
                    </div>
                  )}

                  {item.compatibility_report && (
                    <div className="space-y-1">
                      <span className="text-slate-500 block">Input Verification Matrix:</span>
                      <div className="rounded bg-[#FFF9F4] p-2 border border-[#eeddd3] text-[10px] space-y-1">
                        <div>
                          <span className="text-slate-500">Primary: </span>
                          <span className="text-slate-900 font-semibold">{item.compatibility_report.primary_image?.satellite}</span>
                          <span className="text-slate-500"> ({item.compatibility_report.primary_image?.format}, {item.compatibility_report.primary_image?.crs}, {item.compatibility_report.primary_image?.resolution_meters}m)</span>
                        </div>
                        {item.compatibility_report.secondary_image && (
                          <div>
                            <span className="text-slate-500">Secondary / SAR: </span>
                            <span className="text-slate-900 font-semibold">{item.compatibility_report.secondary_image?.satellite}</span>
                            <span className="text-slate-500"> ({item.compatibility_report.secondary_image?.modality}, {item.compatibility_report.secondary_image?.crs})</span>
                          </div>
                        )}
                        {item.compatibility_report.co_registration_status && (
                          <div className="text-emerald-700 font-semibold pt-1 border-t border-[#eeddd3]">
                            ✓ {item.compatibility_report.co_registration_status}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {item.selected_models && (
                    <div className="space-y-1">
                      <span className="text-slate-500 block">Sequenced Models:</span>
                      <div className="space-y-1">
                        {item.selected_models.map((m: any, i: number) => (
                          <div key={i} className="rounded bg-[#FFF9F4] p-2 border border-[#eeddd3] text-[10px]">
                            <span className="text-[#FD1843] font-bold">{m.name}</span>
                            <span className="text-slate-500 block">Domain: {m.domain_adaptation}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.configured_parameters && (
                    <div>
                      <span className="text-slate-500 block">Enforced Task Parameters:</span>
                      <pre className="rounded bg-[#FFF9F4] p-2 text-[10px] text-slate-800 overflow-x-auto border border-[#eeddd3]">
                        {JSON.stringify(item.configured_parameters, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
