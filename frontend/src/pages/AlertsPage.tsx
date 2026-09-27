import React, { useState } from 'react';
import { AlertTriangle, Check, Trash2, ShieldAlert, Clock, Filter } from 'lucide-react';
import { Alert } from '../types/index.js';
import { alertService } from '../services/alert.service.js';
import { ConfirmModal } from '../components/ConfirmModal.js';

interface AlertsPageProps {
  alerts: Alert[];
  onAlertUpdated: (alert: Alert) => void;
  onAlertDeleted: (id: string) => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  alerts,
  onAlertUpdated,
  onAlertDeleted,
}) => {
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredAlerts = alerts.filter((a) => {
    return filterSeverity === 'ALL' || a.severity === filterSeverity;
  });

  const handleToggleRead = async (alert: Alert) => {
    try {
      const updated = await alertService.markRead(alert.id, !alert.is_read);
      onAlertUpdated(updated);
    } catch (err) {
      console.warn('Failed to update alert:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await alertService.deleteAlert(deleteTargetId);
      onAlertDeleted(deleteTargetId);
    } catch (err) {
      console.warn('Failed to delete alert:', err);
      onAlertDeleted(deleteTargetId);
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'high':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'medium':
        return 'bg-[#FD1843]/10 text-[#FD1843] border-[#FD1843]/20';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-[#eeddd3] bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#FD1843]/10 p-2.5 text-[#FD1843] border border-[#FD1843]/30">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 font-mono">
              Environmental & Land-Cover Change Alerts
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated anomaly notifications triggered by bi-temporal threshold deviations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-600 font-semibold">Severity:</span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3 py-1.5 text-xs text-slate-900 focus:border-[#FD1843] focus:outline-none"
          >
            <option value="ALL">All Severity Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Alerts Stream */}
      <div className="space-y-3">
        {filteredAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-xl border p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              alert.is_read
                ? 'border-[#eeddd3] bg-[#FFF9F4] opacity-80'
                : 'border-[#eeddd3] bg-white shadow-xs'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase border ${getSeverityBadge(
                    alert.severity
                  )}`}
                >
                  {alert.severity}
                </span>
                <span className="rounded bg-[#FD1843]/10 px-2 py-0.5 font-mono text-[10px] text-[#FD1843] font-semibold border border-[#FD1843]/20">
                  {alert.alert_type}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                  <Clock className="w-3 h-3" />
                  {new Date(alert.created_at).toLocaleDateString()}
                </span>
              </div>

              <h3 className="text-sm font-semibold text-slate-900 font-mono">{alert.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">{alert.message}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => handleToggleRead(alert)}
                className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-mono transition-colors ${
                  alert.is_read
                    ? 'border-[#eeddd3] bg-[#FFF9F4] text-slate-600 hover:text-slate-900'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{alert.is_read ? 'Mark Unread' : 'Mark as Read'}</span>
              </button>

              <button
                type="button"
                onClick={() => setDeleteTargetId(alert.id)}
                className="rounded-lg p-2 text-slate-400 hover:bg-[#FFF9F4] hover:text-rose-600 transition-colors"
                title="Dismiss Alert"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filteredAlerts.length === 0 && (
          <div className="rounded-xl border border-[#eeddd3] bg-white p-8 text-center text-xs font-mono text-slate-500 shadow-xs">
            No environmental alerts recorded.
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="Dismiss Environmental Alert"
        message="Are you sure you want to permanently dismiss this anomaly alert from the active notifications feed?"
        confirmLabel={isDeleting ? 'Dismissing...' : 'Dismiss Alert'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
