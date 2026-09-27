import React from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

interface ConfidenceBadgeProps {
  confidence?: number;
  showIcon?: boolean;
  className?: string;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  showIcon = true,
  className = '',
}) => {
  if (confidence === undefined || !Number.isFinite(confidence)) return null;

  const pct = Math.round(confidence > 1 ? confidence : confidence * 100);
  const isHigh = pct >= 85;
  const isMedium = pct >= 70 && pct < 85;

  const colorClass = isHigh
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : isMedium
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-[#FD1843] border-[#FD1843]/30';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${colorClass} ${className}`}
      title={`Model Statistical Confidence: ${pct}%`}
    >
      {showIcon && (
        isHigh ? (
          <ShieldCheck className="w-3.5 h-3.5" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5" />
        )
      )}
      <span>{pct}% Confidence</span>
    </span>
  );
};
