import React from 'react';
import {
  Satellite,
  Bell,
  Menu,
  ChevronDown,
  Activity,
  FolderOpen,
  Plus,
  ShieldCheck,
  Settings,
  LogOut,
  User,
} from 'lucide-react';
import { Project, UserProfile } from '../types/index.js';

interface NavbarProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (project: Project | null) => void;
  onOpenNewProject: () => void;
  user: UserProfile | null;
  unreadAlertCount: number;
  onOpenAlerts: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  onSignOut?: () => void;
  supabaseConnected: boolean;
  currentTab?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onOpenNewProject,
  user,
  unreadAlertCount,
  onOpenAlerts,
  onOpenSettings,
  onToggleSidebar,
  onSignOut,
  supabaseConnected,
  currentTab,
}) => {
  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#eeddd3] bg-[#FFF9F4]/90 px-4 backdrop-blur-xl md:px-6">
      {/* Left: Mobile Toggle & Brand Identity */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-600 hover:bg-[#FD1843]/10 hover:text-[#FD1843] md:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#FD1843]/10 border border-[#FD1843]/30 text-[#FD1843] shadow-inner">
            <Satellite className="w-5 h-5 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FD1843] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FD1843]"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold tracking-tight text-slate-900">
                SatQuery <span className="text-[#FD1843]">AI</span>
              </span>
              <span className="hidden rounded bg-[#FD1843]/10 border border-[#FD1843]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#FD1843] font-semibold sm:inline">
                RS-VLM v2.4
              </span>
            </div>
            <p className="hidden text-[10px] text-slate-500 font-mono sm:block">
              Multimodal Earth Observation Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Center: Project Selector */}
      <div className="hidden lg:flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-[#eeddd3] bg-white px-3 py-1.5 text-xs shadow-xs">
          <FolderOpen className="w-4 h-4 text-[#FD1843] shrink-0" />
          <span className="text-slate-500 font-mono">Project:</span>
          <select
            value={activeProject?.id || ''}
            onChange={(e) => {
              const selected = projects.find((p) => p.id === e.target.value);
              onSelectProject(selected || null);
            }}
            className="bg-transparent font-medium text-slate-900 focus:outline-none cursor-pointer max-w-[200px] truncate"
          >
            <option value="" className="bg-white text-slate-700">
              All Observation Scenes (Global)
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-white text-slate-900">
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onOpenNewProject}
            className="ml-1 flex items-center gap-1 rounded bg-[#FD1843]/10 border border-[#FD1843]/30 px-1.5 py-0.5 text-[11px] font-mono text-[#FD1843] font-semibold hover:bg-[#FD1843]/20 transition-colors"
            title="Create new project workspace"
          >
            <Plus className="w-3 h-3" /> New
          </button>
        </div>
      </div>

      {/* Right: Telemetry & Alerts & User Profile */}
      <div className="flex items-center gap-3">
        {/* Alerts Bell */}
        <button
          type="button"
          onClick={onOpenAlerts}
          className="relative rounded-lg border border-[#eeddd3] bg-white p-2 text-slate-700 hover:border-[#FD1843]/40 hover:text-[#FD1843] shadow-xs transition-colors cursor-pointer"
          title="View Environmental Change Alerts"
        >
          <Bell className="w-4 h-4" />
          {unreadAlertCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FD1843] font-mono text-[9px] font-bold text-white shadow-xs">
              {unreadAlertCount}
            </span>
          )}
        </button>

        {/* Top Right Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className={`relative rounded-lg border p-2 shadow-xs transition-all cursor-pointer ${
            currentTab === 'settings'
              ? 'border-[#FD1843] bg-[#FD1843]/10 text-[#FD1843] font-bold'
              : 'border-[#eeddd3] bg-white text-slate-700 hover:border-[#FD1843]/40 hover:text-[#FD1843]'
          }`}
          title="Station Settings & Configuration"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Card */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#eeddd3]">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FD1843]/15 text-xs font-bold font-mono text-[#FD1843] border border-[#FD1843]/30 overflow-hidden">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-[#FD1843]" />
            )}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-medium text-slate-900 truncate max-w-[120px]">
              {user?.full_name || 'Analyst'}
            </p>
            <p className="text-[10px] text-[#FD1843] font-mono font-medium truncate max-w-[120px]">
              {user?.role || 'Lead Analyst'}
            </p>
          </div>
        </div>

        {/* Sign Out Button */}
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-lg border border-[#eeddd3] bg-white p-2 text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 shadow-xs transition-colors cursor-pointer"
            title="Sign out of SatQuery AI"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
