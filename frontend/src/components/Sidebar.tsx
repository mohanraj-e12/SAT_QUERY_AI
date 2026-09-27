import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Globe,
  Bot,
  Layers,
  PieChart,
  Target,
  Flame,
  Sprout,
  Building2,
  Droplets,
  Settings,
  X,
} from 'lucide-react';

export type NavigationTab =
  | 'dashboard'
  | 'geoscope'
  | 'explore'
  | 'assistant'
  | 'change-detection'
  | 'model-lab'
  | 'land-cover'
  | 'object-detection'
  | 'disaster-analysis'
  | 'agriculture-analysis'
  | 'urban-growth'
  | 'water-vegetation'
  | 'settings';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isOpen: boolean;
  onClose: () => void;
  unreadAlertsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const coreNavItems = [
    {
      id: 'dashboard' as NavigationTab,
      label: 'Mission Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'geoscope' as NavigationTab,
      label: 'GeoScope',
      icon: Globe,
      badge: 'Live AOI',
      badgeColor: 'bg-[#FD1843]/10 text-[#FD1843] border border-[#FD1843]/30',
    },
    {
      id: 'explore' as NavigationTab,
      label: 'Geospatial Map Viewer',
      icon: Compass,
      badge: 'Live',
    },
    {
      id: 'assistant' as NavigationTab,
      label: 'AI Vision Assistant',
      icon: Bot,
      badge: 'VLM AI',
    },
    {
      id: 'change-detection' as NavigationTab,
      label: 'Bi-Temporal Change',
      icon: Layers,
      badge: 'NDVI/NDWI',
    },
  ];

  const analysisModules = [
    {
      id: 'land-cover' as NavigationTab,
      label: 'Land Cover Classification',
      icon: PieChart,
      badge: 'CLC-19',
    },
    {
      id: 'object-detection' as NavigationTab,
      label: 'Object Detection',
      icon: Target,
      badge: 'SAM',
    },
    {
      id: 'disaster-analysis' as NavigationTab,
      label: 'Disaster Analysis',
      icon: Flame,
      badge: 'Floods/Fires',
      badgeColor: 'bg-rose-50 text-rose-700 border border-rose-200',
    },
    {
      id: 'agriculture-analysis' as NavigationTab,
      label: 'Agriculture Analysis',
      icon: Sprout,
      badge: 'NDVI Health',
      badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    },
    {
      id: 'urban-growth' as NavigationTab,
      label: 'Urban Growth Analysis',
      icon: Building2,
      badge: 'NDBI',
    },
    {
      id: 'water-vegetation' as NavigationTab,
      label: 'Water & Vegetation Analysis',
      icon: Droplets,
      badge: 'NDVI/NDWI',
      badgeColor: 'bg-[#FD1843]/10 text-[#FD1843] border border-[#FD1843]/20',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-[70] flex w-64 flex-col border-r border-[#eeddd3] bg-[#FFF9F4] px-3 py-4 transition-transform duration-300 md:static md:z-auto md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between px-2 pb-4 md:hidden border-b border-[#eeddd3]">
          <span className="font-mono text-sm font-bold text-slate-900">SatQueryAI</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-[#FD1843]/10 hover:text-[#FD1843]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 space-y-1 overflow-y-auto py-2">
          <div className="px-3 pb-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
            SATQUERYAI MODULES
          </div>

          {coreNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#FD1843]/10 text-[#FD1843] font-semibold border border-[#FD1843]/30 shadow-xs'
                    : 'text-slate-700 hover:bg-[#FD1843]/5 hover:text-[#FD1843]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#FD1843]' : 'text-slate-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold bg-white text-[#FD1843] border border-[#eeddd3] shrink-0"
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Divider */}
          <div className="my-2 border-t border-[#eeddd3] px-2" />

          {/* Analysis Features Section */}
          <div className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#FD1843]">
            AI ANALYSIS CAPABILITIES
          </div>

          {analysisModules.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#FD1843]/10 text-[#FD1843] font-semibold border border-[#FD1843]/30 shadow-xs'
                    : 'text-slate-700 hover:bg-[#FD1843]/5 hover:text-[#FD1843]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#FD1843]' : 'text-slate-500'}`} />
                  <span className="truncate text-left">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold shrink-0 ${
                      item.badgeColor || 'bg-white text-slate-700 border border-[#eeddd3]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </aside>
    </>
  );
};
