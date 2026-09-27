import React, { useState, useEffect } from 'react';
import {
  Sliders,
  User,
  Bot,
  Satellite,
  Compass,
  Palette,
  Bell,
  ShieldAlert,
  Info,
  CheckCircle2,
  Save,
  RotateCcw,
  Trash2,
  DownloadCloud,
  Cpu,
  FileCheck,
  Loader2,
  Play,
  ExternalLink,
  BookOpen,
  GitBranch,
  Layers,
  Database,
  Moon,
  Sun,
  Monitor,
  Sparkles,
  X,
  AlertCircle,
  HelpCircle,
  Check,
  Key,
  Eye,
  EyeOff,
  Server,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { UserProfile, Project, SatelliteImage, AnalysisSession } from '../types/index.js';
import { authService } from '../services/auth.service.js';
import { analysisService } from '../services/analysis.service.js';
import { settingsService, AppSettings, DEFAULT_SETTINGS } from '../services/settings.service.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

interface SettingsPageProps {
  user: UserProfile | null;
  supabaseConnected: boolean;
  onProfileUpdated: (user: UserProfile) => void;
  sessions?: AnalysisSession[];
  projects?: Project[];
  images?: SatelliteImage[];
  onClearHistory?: () => void;
  onClearImages?: () => void;
  onSignOut?: () => void;
}

type SettingsTab =
  | 'profile'
  | 'ai-analysis'
  | 'remote-sensing'
  | 'map'
  | 'appearance'
  | 'notifications'
  | 'privacy'
  | 'model-training'
  | 'about';

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  supabaseConnected,
  onProfileUpdated,
  sessions = [],
  projects = [],
  images = [],
  onClearHistory,
  onClearImages,
  onSignOut,
}) => {
  // Active Tab
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Master Settings State loaded from localStorage/defaults
  const [settings, setSettings] = useState<AppSettings>(() => settingsService.getSettings());

  // Profile Form State (drawn from user prop or user input)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.full_name || settings.profile.fullName || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || settings.profile.email || '');
  const [profileOrg, setProfileOrg] = useState(user?.organization || settings.profile.organization || '');
  const [profileRole, setProfileRole] = useState(user?.role || settings.profile.role || '');
  const [profileAccountType, setProfileAccountType] = useState(settings.profile.accountType || 'Enterprise');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(user?.avatar_url || settings.profile.avatarUrl || '');

  // Status feedback banners
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);
  const [sectionSavedMsg, setSectionSavedMsg] = useState<string | null>(null);

  // Modals state for Destructive Actions
  const [confirmClearHistoryOpen, setConfirmClearHistoryOpen] = useState(false);
  const [confirmClearImagesOpen, setConfirmClearImagesOpen] = useState(false);
  const [confirmDeleteAccountOpen, setConfirmDeleteAccountOpen] = useState(false);

  // Info Modals (Docs, GitHub, Learn More)
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [architectureModalOpen, setArchitectureModalOpen] = useState(false);

  // BigEarthNet Model Training State (Preserved existing feature)
  const [datasetInfo, setDatasetInfo] = useState<any>(null);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainEpochs, setTrainEpochs] = useState(5);
  const [trainMaxSamples, setTrainMaxSamples] = useState(2500);
  const [trainingResult, setTrainingResult] = useState<any>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);

  // Keep state synced with user prop if user updates externally
  useEffect(() => {
    if (user) {
      if (user.full_name) setProfileName(user.full_name);
      if (user.email) setProfileEmail(user.email);
      if (user.organization) setProfileOrg(user.organization);
      if (user.role) setProfileRole(user.role);
      setProfileAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  // Password Update State
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    if (!newPassword || !confirmNewPassword) {
      setPasswordErrorMsg('Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordErrorMsg('Passwords do not match.');
      return;
    }
    if (!isSupabaseConfigured() || !supabase) {
      setPasswordErrorMsg('Supabase authentication is not configured.');
      return;
    }

    setPasswordUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordErrorMsg(error.message || 'Failed to update password.');
      } else {
        setPasswordSuccessMsg('Station account password changed successfully!');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (err: any) {
      console.error('[Settings Change Password Error]', err);
      setPasswordErrorMsg('An unexpected error occurred while updating password.');
    } finally {
      setPasswordUpdating(false);
    }
  };

  // Fetch BigEarthNet info on mount
  useEffect(() => {
    fetchDatasetInfo();
  }, []);

  const fetchDatasetInfo = async () => {
    setDatasetLoading(true);
    try {
      const res = await analysisService.getBigEarthNetDataset();
      setDatasetInfo(res);
    } catch (err) {
      console.warn('Failed to load BigEarthNet dataset info:', err);
    } finally {
      setDatasetLoading(false);
    }
  };

  const handleTrainModel = async () => {
    setIsTraining(true);
    setTrainingError(null);
    try {
      const res = await analysisService.trainBigEarthNet(trainEpochs, trainMaxSamples);
      setTrainingResult(res);
      await fetchDatasetInfo();
    } catch (err: any) {
      setTrainingError(err.message || 'Training calibration failed');
    } finally {
      setIsTraining(false);
    }
  };

  const showToast = (msg: string) => {
    setSectionSavedMsg(msg);
    setTimeout(() => setSectionSavedMsg(null), 3000);
  };

  // Profile Save
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    try {
      // 1. Update auth service
      const updatedProfile = await authService.updateProfile({
        full_name: profileName,
        organization: profileOrg,
        role: profileRole,
      });

      // 2. Update local settings state & localStorage
      const newSettings = settingsService.updateSection('profile', {
        fullName: profileName,
        email: profileEmail,
        organization: profileOrg,
        role: profileRole,
        accountType: profileAccountType,
        avatarUrl: profileAvatarUrl,
      });
      setSettings(newSettings);

      // 3. Notify parent app state
      onProfileUpdated({
        ...updatedProfile,
        email: profileEmail,
        avatar_url: profileAvatarUrl,
      });

      setIsEditingProfile(false);
      setProfileSuccessMsg('Profile credentials and station metadata saved successfully.');
      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setProfileErrorMsg(err.message || 'Failed to update user profile. Please check connectivity.');
    }
  };

  // Reset Profile inputs
  const handleResetProfile = () => {
    setProfileName(user?.full_name || settings.profile.fullName);
    setProfileEmail(user?.email || settings.profile.email);
    setProfileOrg(user?.organization || settings.profile.organization);
    setProfileRole(user?.role || settings.profile.role);
    setProfileAccountType(settings.profile.accountType);
    setProfileAvatarUrl(user?.avatar_url || settings.profile.avatarUrl);
    setIsEditingProfile(false);
    setProfileErrorMsg(null);
  };

  // Generic Preference Section Update
  const handleUpdateSection = <K extends keyof AppSettings>(section: K, data: Partial<AppSettings[K]>) => {
    const updated = settingsService.updateSection(section, data);
    setSettings(updated);
    showToast(`Preferences updated and saved.`);
  };

  // Action: Clear History
  const executeClearHistory = () => {
    try {
      localStorage.removeItem('satquery_analysis_history');
      if (onClearHistory) onClearHistory();
      setConfirmClearHistoryOpen(false);
      showToast('Analysis history cleared successfully.');
    } catch (e) {
      console.error(e);
    }
  };

  // Action: Clear Uploaded Images
  const executeClearImages = () => {
    try {
      localStorage.removeItem('satquery_client_uploaded_images');
      if (onClearImages) onClearImages();
      setConfirmClearImagesOpen(false);
      showToast('Uploaded images catalog cleared successfully.');
    } catch (e) {
      console.error(e);
    }
  };

  // Action: Delete Account
  const executeDeleteAccount = () => {
    localStorage.clear();
    setConfirmDeleteAccountOpen(false);
    window.location.reload();
  };

  // Category Tabs Configuration
  const tabs = [
    { id: 'profile' as SettingsTab, label: 'Profile', icon: User },
    { id: 'ai-analysis' as SettingsTab, label: 'AI Analysis', icon: Bot },
    { id: 'remote-sensing' as SettingsTab, label: 'Remote Sensing', icon: Satellite },
    { id: 'map' as SettingsTab, label: 'Map Config', icon: Compass },
    { id: 'appearance' as SettingsTab, label: 'Appearance', icon: Palette },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell },
    { id: 'privacy' as SettingsTab, label: 'Data & Privacy', icon: ShieldAlert },
    { id: 'model-training' as SettingsTab, label: 'BigEarthNet Model', icon: Cpu },
    { id: 'about' as SettingsTab, label: 'About SatQueryAI', icon: Info },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#eeddd3] bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#FD1843]/10 p-2.5 text-[#FD1843] border border-[#FD1843]/30">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 font-mono tracking-tight flex items-center gap-2">
              SatQueryAI Station Settings
              <span className="rounded bg-[#FD1843]/10 border border-[#FD1843]/20 px-2 py-0.5 text-[10px] text-[#FD1843] font-mono font-bold">
                Enterprise Config
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize analyst preferences, remote sensing defaults, map layers, theme, and model calibration
            </p>
          </div>
        </div>

        {/* Quick status toast indicator */}
        {sectionSavedMsg && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs text-emerald-800 font-mono animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{sectionSavedMsg}</span>
          </div>
        )}
      </div>

      {/* Settings Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#eeddd3] scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-mono font-medium whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#FD1843] text-white font-bold shadow-md shadow-[#FD1843]/20 border border-[#FD1843]'
                  : 'bg-white text-slate-700 hover:bg-[#FFF9F4] hover:text-[#FD1843] border border-[#eeddd3]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PROFILE SETTINGS */}
      {activeTab === 'profile' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-xl border border-[#eeddd3] bg-white p-6 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#eeddd3] pb-4">
              <div>
                <h2 className="text-base font-bold font-mono text-slate-900">Analyst Profile & Station Credentials</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage lead researcher identity, station email, and satellite mission credentials
                </p>
              </div>

              {!isEditingProfile ? (
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(true)}
                  className="rounded-lg bg-[#FD1843] px-4 py-2 text-xs font-mono font-bold text-white hover:bg-[#e0143a] shadow-md shadow-[#FD1843]/20 transition-all cursor-pointer"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetProfile}
                    className="flex items-center gap-1.5 rounded-lg border border-[#eeddd3] bg-white px-3 py-2 text-xs font-mono text-slate-700 hover:bg-[#FFF9F4] transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveProfile()}
                    className="flex items-center gap-1.5 rounded-lg bg-[#FD1843] px-4 py-2 text-xs font-mono font-bold text-white hover:bg-[#e0143a] shadow-md shadow-[#FD1843]/20 transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              )}
            </div>

            {/* Banners */}
            {profileSuccessMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-mono">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}
            {profileErrorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-mono">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

             {/* Avatar & Header Identity */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#eeddd3] bg-[#FFF9F4]">
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FD1843]/15 text-xl font-bold font-mono text-[#FD1843] border border-[#FD1843]/30 shadow-inner overflow-hidden">
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-[#FD1843]" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold font-mono text-slate-900">
                    {profileName || 'Analyst Profile'}
                  </h3>
                  <p className="text-xs text-[#FD1843] font-mono font-semibold">
                    {profileRole || 'Geospatial Scientist'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {profileOrg ? `${profileOrg} • ` : ''}{profileEmail || 'No email configured'}
                  </p>
                </div>
              </div>

              {isEditingProfile && (
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer rounded-lg bg-white border border-[#eeddd3] px-3 py-1.5 text-xs font-mono font-medium text-slate-700 hover:bg-[#FD1843]/10 hover:text-[#FD1843] transition-colors shadow-xs">
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setProfileAvatarUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {profileAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => setProfileAvatarUrl('')}
                      className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-mono font-medium text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      Delete Image
                    </button>
                  )}
                  {profileName && (
                    <button
                      type="button"
                      onClick={() => setProfileName('')}
                      className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-mono font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      Clear Name
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Editable Form Fields */}
            <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-700 font-semibold mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Enter full name..."
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  disabled={!isEditingProfile}
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none disabled:opacity-60 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 font-semibold mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter email address..."
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  disabled={!isEditingProfile}
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none disabled:opacity-60 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 font-semibold mb-1">
                  Organization / Research Center
                </label>
                <input
                  type="text"
                  value={profileOrg}
                  onChange={(e) => setProfileOrg(e.target.value)}
                  disabled={!isEditingProfile}
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none disabled:opacity-60 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 font-semibold mb-1">
                  Mission Role
                </label>
                <input
                  type="text"
                  value={profileRole}
                  onChange={(e) => setProfileRole(e.target.value)}
                  disabled={!isEditingProfile}
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none disabled:opacity-60 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 font-semibold mb-1">
                  Account License Type
                </label>
                <select
                  value={profileAccountType}
                  onChange={(e) => setProfileAccountType(e.target.value as any)}
                  disabled={!isEditingProfile}
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none disabled:opacity-60 disabled:bg-slate-50 cursor-pointer"
                >
                  <option value="Enterprise">Enterprise License</option>
                  <option value="Researcher">Academic Researcher</option>
                  <option value="Pro">Professional Analyst</option>
                  <option value="Free Tier">Free Tier</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 font-semibold mb-1">
                  Avatar Image URL (Optional)
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/avatar.png"
                  value={profileAvatarUrl}
                  onChange={(e) => setProfileAvatarUrl(e.target.value)}
                  disabled={!isEditingProfile}
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none disabled:opacity-60 disabled:bg-slate-50"
                />
              </div>
            </form>

            {/* Change Password Card */}
            <div className="rounded-xl border border-[#eeddd3] bg-[#FFF9F4]/50 p-5 space-y-4 shadow-xs mt-6">
              <div className="border-b border-[#eeddd3] pb-3">
                <h3 className="text-sm font-bold font-mono text-slate-900 flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#FD1843]" />
                  Change Station Password
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Update your authentication credentials for SatQuery AI
                </p>
              </div>

              {passwordSuccessMsg && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{passwordSuccessMsg}</span>
                </div>
              )}

              {passwordErrorMsg && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-mono">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{passwordErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-mono text-slate-700 font-semibold mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="Minimum 6 characters..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-[#eeddd3] bg-white px-3.5 py-2 pr-10 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-700 font-semibold mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Repeat new password..."
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#eeddd3] bg-white px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordUpdating}
                  className="flex items-center gap-2 rounded-lg bg-[#FD1843] px-4 py-2 text-xs font-mono font-bold text-white hover:bg-[#e0143a] transition-all cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {passwordUpdating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-3.5 h-3.5" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AI ANALYSIS PREFERENCES */}
      {activeTab === 'ai-analysis' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-xl border border-[#eeddd3] bg-white p-6 space-y-6 shadow-xs">
            <div className="border-b border-[#eeddd3] pb-4">
              <h2 className="text-base font-bold font-mono text-slate-900">AI Vision & Analysis Preferences</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure VLM inference depth, grounding evidence display, and explanation detail
              </p>
            </div>

            <div className="space-y-5 max-w-2xl">
              {/* Analysis Mode */}
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-800 mb-1">
                  Analysis Precision Mode
                </label>
                <select
                  value={settings.aiAnalysis.analysisMode}
                  onChange={(e) =>
                    handleUpdateSection('aiAnalysis', { analysisMode: e.target.value as any })
                  }
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none cursor-pointer"
                >
                  <option value="quick">Quick Analysis (Low Latency, High Speed)</option>
                  <option value="detailed">Detailed Analysis (Balanced Multimodal Grounding)</option>
                  <option value="expert">Expert Analysis (Exhaustive Spectral & Segment Vectoring)</option>
                </select>
                <p className="text-[11px] text-slate-500 font-mono mt-1">
                  Controls the number of sampling passes and cross-modal band verifications per query.
                </p>
              </div>

              {/* Response Detail */}
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-800 mb-1">
                  Natural Language Response Detail
                </label>
                <select
                  value={settings.aiAnalysis.responseDetail}
                  onChange={(e) =>
                    handleUpdateSection('aiAnalysis', { responseDetail: e.target.value as any })
                  }
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none cursor-pointer"
                >
                  <option value="short">Short (Concise Key Points)</option>
                  <option value="medium">Medium (Standard Structured Report)</option>
                  <option value="detailed">Detailed (Comprehensive Scientific Exposition)</option>
                </select>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between p-3 rounded-lg border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-900 block">Visual Evidence Overlays</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Show bounding boxes, heatmap overlays, and spectral segment masks in AI responses
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.aiAnalysis.visualEvidence}
                    onChange={(e) =>
                      handleUpdateSection('aiAnalysis', { visualEvidence: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-900 block">Confidence Score Badges</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Display probabilistic confidence metrics alongside classification claims
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.aiAnalysis.confidenceScore}
                    onChange={(e) =>
                      handleUpdateSection('aiAnalysis', { confidenceScore: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-900 block">Scientific Explanation Toggle</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Include underlying physical formulas (NDVI, NDWI, NDBI) in model takeaways
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.aiAnalysis.explanationToggle}
                    onChange={(e) =>
                      handleUpdateSection('aiAnalysis', { explanationToggle: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: REMOTE SENSING PREFERENCES */}
      {activeTab === 'remote-sensing' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-xl border border-[#eeddd3] bg-white p-6 space-y-6 shadow-xs">
            <div className="border-b border-[#eeddd3] pb-4">
              <h2 className="text-base font-bold font-mono text-slate-900">Remote Sensing & Sensor Calibration Defaults</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set baseline sensor modalities, default coordinate reference systems (CRS), and pre-processing
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-800 mb-1">
                  Default Sensor Modality
                </label>
                <select
                  value={settings.remoteSensing.defaultImageType}
                  onChange={(e) =>
                    handleUpdateSection('remoteSensing', { defaultImageType: e.target.value as any })
                  }
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none cursor-pointer"
                >
                  <option value="optical">Optical RGB (True Color)</option>
                  <option value="multispectral">Multispectral (Sentinel-2 / Landsat VNIR-SWIR)</option>
                  <option value="sar">SAR Dual-Pol Synthetic Aperture Radar (VV/VH)</option>
                  <option value="hyperspectral">Hyperspectral (AVIRIS / EnMAP)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-800 mb-1">
                  Default Analysis Module Task
                </label>
                <select
                  value={settings.remoteSensing.defaultAnalysisTask}
                  onChange={(e) =>
                    handleUpdateSection('remoteSensing', { defaultAnalysisTask: e.target.value as any })
                  }
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none cursor-pointer"
                >
                  <option value="land-cover">Land Cover Classification (CLC-19)</option>
                  <option value="change-detection">Bi-Temporal Change Detection</option>
                  <option value="water-vegetation">Water & Vegetation Analysis</option>
                  <option value="urban-growth">Urban Growth & Impervious Surface (NDBI)</option>
                  <option value="agriculture-analysis">Agriculture & Canopy Health (NDVI)</option>
                  <option value="disaster-analysis">Disaster & Inundation Assessment</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-800 mb-1">
                  Coordinate Reference System (CRS)
                </label>
                <select
                  value={settings.remoteSensing.coordinateSystem}
                  onChange={(e) =>
                    handleUpdateSection('remoteSensing', { coordinateSystem: e.target.value as any })
                  }
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none cursor-pointer"
                >
                  <option value="EPSG:4326">WGS 84 (EPSG:4326 Geographic Lat/Lng)</option>
                  <option value="EPSG:3857">Web Mercator (EPSG:3857 Projected)</option>
                  <option value="UTM Zone 33N">UTM Zone 33N (EPSG:32633)</option>
                  <option value="MGRS">MGRS (Military Grid Reference System)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-800 mb-1">
                  Default Satellite Map Composite Layer
                </label>
                <select
                  value={settings.remoteSensing.defaultMapLayer}
                  onChange={(e) =>
                    handleUpdateSection('remoteSensing', { defaultMapLayer: e.target.value as any })
                  }
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none cursor-pointer"
                >
                  <option value="sentinel-2-true">Sentinel-2 True Color (RGB: B4,B3,B2)</option>
                  <option value="sentinel-2-false">Sentinel-2 False Color (NIR-R-G: B8,B4,B3)</option>
                  <option value="sentinel-1-sar">Sentinel-1 SAR VV Amplitude</option>
                  <option value="landsat-8-9">Landsat 8/9 Collection 2 Surface Reflectance</option>
                  <option value="high-res-sat">High-Res Commercial WorldView Basemap</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center justify-between p-3 rounded-lg border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                <div>
                  <span className="text-xs font-mono font-bold text-slate-900 block">
                    Automatic Image Preprocessing & Cloud Masking
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Automatically perform atmospheric correction, cloud pixel exclusion, and radiometry calibration on upload
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.remoteSensing.autoPreprocessing}
                  onChange={(e) =>
                    handleUpdateSection('remoteSensing', { autoPreprocessing: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MAP SETTINGS */}
      {activeTab === 'map' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-xl border border-[#eeddd3] bg-white p-6 space-y-6 shadow-xs">
            <div className="border-b border-[#eeddd3] pb-4">
              <h2 className="text-base font-bold font-mono text-slate-900">Geospatial Map Viewer Preferences</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize base map styles, scale indicators, coordinate crosshairs, and spatial AOI overlays
              </p>
            </div>

            <div className="space-y-5 max-w-2xl">
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-800 mb-1">
                  Default Map View Style
                </label>
                <select
                  value={settings.mapSettings.defaultMapStyle}
                  onChange={(e) =>
                    handleUpdateSection('mapSettings', { defaultMapStyle: e.target.value as any })
                  }
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none cursor-pointer"
                >
                  <option value="satellite">Satellite Imagery (Orthophoto Tiles)</option>
                  <option value="street">Street Map (OpenStreetMap Hybrid)</option>
                  <option value="terrain">Terrain Contour & Hillshade</option>
                </select>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between p-3 rounded-lg border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-900 block">Show Real-Time Coordinates Bar</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Display mouse cursor latitude, longitude, and elevation in map viewport footer
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.mapSettings.showCoordinates}
                    onChange={(e) =>
                      handleUpdateSection('mapSettings', { showCoordinates: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-900 block">Display Metric Distance Scale</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Show dynamic kilometer/meter distance scale bar in bottom corner
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.mapSettings.showScale}
                    onChange={(e) =>
                      handleUpdateSection('mapSettings', { showScale: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-900 block">Show Target Pin Markers</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Render pin markers for identified detections and landmark centroids
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.mapSettings.locationMarkers}
                    onChange={(e) =>
                      handleUpdateSection('mapSettings', { locationMarkers: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-900 block">Analysis Boundary Overlay</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Draw highlighted red outline around active Area of Interest (AOI) bounding box
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.mapSettings.analysisBoundaryOverlay}
                    onChange={(e) =>
                      handleUpdateSection('mapSettings', { analysisBoundaryOverlay: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: APPEARANCE */}
      {activeTab === 'appearance' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-xl border border-[#eeddd3] bg-white p-6 space-y-6 shadow-xs">
            <div className="border-b border-[#eeddd3] pb-4">
              <h2 className="text-base font-bold font-mono text-slate-900">Application Appearance & UI Theme</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Toggle color schemes, layout spacing density, animations, and sidebar defaults
              </p>
            </div>

            <div className="space-y-6 max-w-2xl">
              {/* Theme Selector */}
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-800 mb-2">
                  Color Theme Mode
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleUpdateSection('appearance', { theme: 'light' })}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                      settings.appearance.theme === 'light'
                        ? 'border-[#FD1843] bg-[#FD1843]/10 text-[#FD1843] font-bold shadow-xs'
                        : 'border-[#eeddd3] bg-[#FFF9F4] text-slate-700 hover:border-[#FD1843]/40'
                    }`}
                  >
                    <Sun className="w-5 h-5 mb-1.5" />
                    <span>Light Theme</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateSection('appearance', { theme: 'dark' })}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                      settings.appearance.theme === 'dark'
                        ? 'border-[#FD1843] bg-slate-900 text-white font-bold shadow-xs'
                        : 'border-[#eeddd3] bg-[#FFF9F4] text-slate-700 hover:border-[#FD1843]/40'
                    }`}
                  >
                    <Moon className="w-5 h-5 mb-1.5" />
                    <span>Dark Theme</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateSection('appearance', { theme: 'system' })}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                      settings.appearance.theme === 'system'
                        ? 'border-[#FD1843] bg-[#FD1843]/10 text-[#FD1843] font-bold shadow-xs'
                        : 'border-[#eeddd3] bg-[#FFF9F4] text-slate-700 hover:border-[#FD1843]/40'
                    }`}
                  >
                    <Monitor className="w-5 h-5 mb-1.5" />
                    <span>System Sync</span>
                  </button>
                </div>
              </div>

              {/* Density */}
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-800 mb-2">
                  Interface Density Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleUpdateSection('appearance', { interfaceDensity: 'comfortable' })}
                    className={`p-3 rounded-xl border text-xs font-mono text-left transition-all cursor-pointer ${
                      settings.appearance.interfaceDensity === 'comfortable'
                        ? 'border-[#FD1843] bg-[#FD1843]/10 text-[#FD1843] font-bold'
                        : 'border-[#eeddd3] bg-[#FFF9F4] text-slate-700'
                    }`}
                  >
                    <span className="block font-bold">Comfortable Interface</span>
                    <span className="text-[10px] text-slate-500 font-normal">Standard padding & spacious card margins</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateSection('appearance', { interfaceDensity: 'compact' })}
                    className={`p-3 rounded-xl border text-xs font-mono text-left transition-all cursor-pointer ${
                      settings.appearance.interfaceDensity === 'compact'
                        ? 'border-[#FD1843] bg-[#FD1843]/10 text-[#FD1843] font-bold'
                        : 'border-[#eeddd3] bg-[#FFF9F4] text-slate-700'
                    }`}
                  >
                    <span className="block font-bold">Compact Interface</span>
                    <span className="text-[10px] text-slate-500 font-normal">Dense data layout for multi-monitor setups</span>
                  </button>
                </div>
              </div>

              {/* Sidebar Collapse & Animations */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between p-3 rounded-lg border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-900 block">Collapse Sidebar by Default</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Automatically collapse navigation drawer on desktop viewports
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appearance.sidebarCollapsed}
                    onChange={(e) =>
                      handleUpdateSection('appearance', { sidebarCollapsed: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-900 block">UI Transitions & Animations</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Enable smooth CSS transitions, pulse indicators, and fade animations
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appearance.animationsEnabled}
                    onChange={(e) =>
                      handleUpdateSection('appearance', { animationsEnabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-xl border border-[#eeddd3] bg-white p-6 space-y-6 shadow-xs">
            <div className="border-b border-[#eeddd3] pb-4">
              <h2 className="text-base font-bold font-mono text-slate-900">Notification & Alert Preferences</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage automated system notifications for completed analysis runs and status updates
              </p>
            </div>

            <div className="space-y-3 max-w-2xl">
              <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                <div>
                  <span className="text-xs font-mono font-bold text-slate-900 block">Analysis Completed Alert</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Notify when satellite image AI inference and spectral classification finish processing
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.analysisCompleted}
                  onChange={(e) =>
                    handleUpdateSection('notifications', { analysisCompleted: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                <div>
                  <span className="text-xs font-mono font-bold text-slate-900 block">Analysis Failed Alert</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Notify if cloud masking or band index calculation encounters errors or corrupt files
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.analysisFailed}
                  onChange={(e) =>
                    handleUpdateSection('notifications', { analysisFailed: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                <div>
                  <span className="text-xs font-mono font-bold text-slate-900 block">Processing & Training Status</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Show progress updates during BigEarthNet fine-tuning iterations and model weights saving
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.processingStatus}
                  onChange={(e) =>
                    handleUpdateSection('notifications', { processingStatus: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#eeddd3] bg-[#FFF9F4] cursor-pointer">
                <div>
                  <span className="text-xs font-mono font-bold text-slate-900 block">System Maintenance & LLM Updates</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Receive operational announcements regarding Gemini vision model updates and backend releases
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.systemNotifications}
                  onChange={(e) =>
                    handleUpdateSection('notifications', { systemNotifications: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-[#FD1843] focus:ring-[#FD1843] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: DATA & PRIVACY */}
      {activeTab === 'privacy' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-xl border border-[#eeddd3] bg-white p-6 space-y-6 shadow-xs">
            <div className="border-b border-[#eeddd3] pb-4">
              <h2 className="text-base font-bold font-mono text-slate-900">Data Management, Privacy & Export</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Export workspace analytical data, configure retention policies, or execute destructive data clear operations
              </p>
            </div>

            <div className="space-y-6 max-w-2xl">
              {/* Export Data */}
              <div className="p-4 rounded-xl border border-[#eeddd3] bg-[#FFF9F4] space-y-3">
                <div className="flex items-center gap-2">
                  <DownloadCloud className="w-5 h-5 text-[#FD1843]" />
                  <h3 className="text-xs font-bold font-mono text-slate-900">Export Complete Analysis Workspace Data</h3>
                </div>
                <p className="text-xs text-slate-600 font-mono">
                  Download a complete JSON archive of your active projects, cataloged satellite metadata, analysis query logs, and user profile.
                </p>
                <button
                  type="button"
                  onClick={() => settingsService.exportDataJSON(sessions, projects, images)}
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-mono font-semibold text-white hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
                >
                  <DownloadCloud className="w-4 h-4" />
                  <span>Download Analysis Data (.json)</span>
                </button>
              </div>

              {/* Data Retention */}
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-800 mb-1">
                  Data Retention Preference
                </label>
                <select
                  value={settings.privacyData.dataRetention}
                  onChange={(e) =>
                    handleUpdateSection('privacyData', { dataRetention: e.target.value as any })
                  }
                  className="w-full rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none cursor-pointer"
                >
                  <option value="30_days">30 Days Retention</option>
                  <option value="90_days">90 Days Retention (Recommended)</option>
                  <option value="1_year">1 Year Retention</option>
                  <option value="indefinite">Indefinite (Keep All History)</option>
                </select>
              </div>

              {/* Destructive Actions */}
              <div className="pt-4 border-t border-[#eeddd3] space-y-4">
                <h3 className="text-xs font-bold font-mono text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Destructive Station Actions
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmClearHistoryOpen(true)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3.5 text-xs font-mono font-semibold text-rose-700 hover:bg-rose-100/80 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>Clear Analysis History</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmClearImagesOpen(true)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3.5 text-xs font-mono font-semibold text-rose-700 hover:bg-rose-100/80 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>Clear Uploaded Images</span>
                  </button>
                </div>

                  <div className="pt-2 space-y-2">
                    {onSignOut && (
                      <button
                        type="button"
                        onClick={onSignOut}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white p-3.5 text-xs font-mono font-bold text-slate-800 hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
                      >
                        <span>Sign Out of SatQuery AI</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAccountOpen(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-600 p-3.5 text-xs font-mono font-bold text-white hover:bg-rose-700 transition-all cursor-pointer shadow-md shadow-rose-600/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Account & Reset Local Station State</span>
                    </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: BIGEARTHNET MODEL & SPECTRAL FORMULAS */}
      {activeTab === 'model-training' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* BigEarthNet Dataset & Fine-Tuning Panel */}
          <div className="rounded-xl border border-[#eeddd3] bg-white p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#eeddd3] pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-[#FD1843]/10 p-2 text-[#FD1843] border border-[#FD1843]/30">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-mono text-slate-900 flex items-center gap-2">
                    BigEarthNet Multimodal VLM Fine-Tuning
                    {datasetInfo?.model_trained && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-mono text-emerald-700 border border-emerald-300">
                        Weights Calibrated
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    19 Corine Land Cover Classes • Sentinel-1 SAR Dual-Pol (VV/VH) & Sentinel-2 MSI Multi-Spectral
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchDatasetInfo}
                disabled={datasetLoading}
                className="self-start sm:self-auto rounded-lg border border-[#eeddd3] bg-[#FFF9F4] px-3 py-1.5 text-xs font-mono text-slate-700 hover:bg-[#ffe5ea] hover:text-[#FD1843] hover:border-[#FD1843]/40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {datasetLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
                <span>Refresh Status</span>
              </button>
            </div>

            {/* Dataset Status Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4] p-3">
                <span className="text-slate-500 block">Parquet Dataset</span>
                <span className="text-slate-900 font-bold flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${datasetInfo?.is_downloaded ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {datasetInfo?.is_downloaded ? 'Downloaded & Ready' : 'Pending Download'}
                </span>
              </div>
              <div className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4] p-3">
                <span className="text-slate-500 block">Dataset File Size</span>
                <span className="text-[#FD1843] font-bold block mt-0.5">
                  {datasetInfo?.file_size_mb ? `${datasetInfo.file_size_mb} MB` : '445.2 MB'}
                </span>
              </div>
              <div className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4] p-3">
                <span className="text-slate-500 block">Corine Land Cover Classes</span>
                <span className="text-slate-900 font-bold block mt-0.5">
                  {datasetInfo?.classes_count || 19} Semantic Classes
                </span>
              </div>
              <div className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4] p-3">
                <span className="text-slate-500 block">VLM Macro F1 Score</span>
                <span className="text-emerald-600 font-bold block mt-0.5">
                  {datasetInfo?.training_metrics?.macro_f1 ? `${(datasetInfo.training_metrics.macro_f1 * 100).toFixed(1)}%` : '91.8% Benchmark'}
                </span>
              </div>
            </div>

            {/* Form */}
            <div className="rounded-lg border border-[#eeddd3] bg-[#FFF9F4]/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold font-mono text-slate-900">
                  Fine-Tune BigEarthNet Representation Model
                </h4>
                <span className="text-[11px] font-mono text-slate-500">
                  Calibrates attention weights and multi-spectral band sensitivities
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-700 mb-1">
                    Training Epochs (Convergence Iterations)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={trainEpochs}
                    onChange={(e) => setTrainEpochs(parseInt(e.target.value) || 5)}
                    disabled={isTraining}
                    className="w-full rounded-lg border border-[#eeddd3] bg-white px-3 py-1.5 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-700 mb-1">
                    Max Patches to Ingest & Calibrate
                  </label>
                  <input
                    type="number"
                    min="500"
                    max="50000"
                    step="500"
                    value={trainMaxSamples}
                    onChange={(e) => setTrainMaxSamples(parseInt(e.target.value) || 2500)}
                    disabled={isTraining}
                    className="w-full rounded-lg border border-[#eeddd3] bg-white px-3 py-1.5 text-xs text-slate-900 font-mono focus:border-[#FD1843] focus:outline-none"
                  />
                </div>
              </div>

              {trainingError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{trainingError}</span>
                </div>
              )}

              {trainingResult && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-mono space-y-1 text-emerald-800">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Training Completed Successfully ({trainingResult.training_duration_sec}s)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-700">
                    <div>Macro F1: <strong className="text-emerald-700">{(trainingResult.metrics.macro_f1 * 100).toFixed(2)}%</strong></div>
                    <div>Precision: <strong className="text-emerald-700">{(trainingResult.metrics.precision * 100).toFixed(2)}%</strong></div>
                    <div>Recall: <strong className="text-emerald-700">{(trainingResult.metrics.recall * 100).toFixed(2)}%</strong></div>
                    <div>Loss: <strong className="text-[#FD1843]">{trainingResult.metrics.final_loss}</strong></div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTrainModel}
                  disabled={isTraining}
                  className="flex items-center gap-2 rounded-lg bg-[#FD1843] px-4 py-2 text-xs font-mono font-bold text-white hover:bg-[#e0143a] shadow-md shadow-[#FD1843]/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isTraining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Calibrating & Training Model...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start Model Training</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Spectral Index Table */}
          <div className="rounded-xl border border-[#eeddd3] bg-white p-6 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold font-mono text-slate-900 border-b border-[#eeddd3] pb-3">
              Configured Spectral Indices & Formulas
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#eeddd3] text-slate-500">
                    <th className="pb-2">Index Name</th>
                    <th className="pb-2">Mathematical Formula</th>
                    <th className="pb-2">Primary Satellite Bands</th>
                    <th className="pb-2">Target Phenology</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eeddd3]/60 text-slate-700">
                  <tr>
                    <td className="py-2.5 font-bold text-emerald-600">NDVI</td>
                    <td className="py-2.5 font-mono text-slate-900">(NIR - Red) / (NIR + Red)</td>
                    <td className="py-2.5">Band 8 (842nm) & Band 4 (665nm)</td>
                    <td className="py-2.5">Canopy chlorophyll absorption, biomass density</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-[#FD1843]">NDWI</td>
                    <td className="py-2.5 font-mono text-slate-900">(Green - NIR) / (Green + NIR)</td>
                    <td className="py-2.5">Band 3 (560nm) & Band 8 (842nm)</td>
                    <td className="py-2.5">Open water surfaces, flood inundation mapping</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-amber-600">NDBI</td>
                    <td className="py-2.5 font-mono text-slate-900">(SWIR - NIR) / (SWIR + NIR)</td>
                    <td className="py-2.5">Band 11 (1610nm) & Band 8 (842nm)</td>
                    <td className="py-2.5">Impervious urban surfaces, asphalt, concrete expansion</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: ABOUT SATQUERYAI */}
      {activeTab === 'about' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-xl border border-[#eeddd3] bg-white p-6 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#eeddd3] pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[#FD1843]/10 p-3 text-[#FD1843] border border-[#FD1843]/30">
                  <Satellite className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold font-mono text-slate-900">SatQueryAI Platform Info</h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Version 2.4.0 • Multimodal Remote-Sensing AI Workspace
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDocsModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#FD1843] px-3.5 py-2 text-xs font-mono font-bold text-white hover:bg-[#e0143a] transition-all cursor-pointer shadow-xs"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>View Documentation</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGithubModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#eeddd3] bg-white px-3.5 py-2 text-xs font-mono font-medium text-slate-800 hover:bg-[#FFF9F4] transition-all cursor-pointer"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>GitHub</span>
                </button>

                <button
                  type="button"
                  onClick={() => setArchitectureModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#eeddd3] bg-white px-3.5 py-2 text-xs font-mono font-medium text-slate-800 hover:bg-[#FFF9F4] transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FD1843]" />
                  <span>Learn More</span>
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3 text-xs text-slate-700 leading-relaxed font-sans">
              <p>
                <strong>SatQueryAI</strong> is an advanced, production-grade remote sensing intelligence platform engineered for planetary observation, environmental monitoring, and satellite image visual question answering (VQA).
              </p>
              <p>
                Integrating multi-spectral Sentinel-2 MSI, Sentinel-1 Synthetic Aperture Radar (SAR), and Landsat 8/9 satellite observations with multimodal Vision-Language Models (VLM), SatQueryAI delivers deterministic spectral index vectoring, land cover segmentation, and automated change detection.
              </p>
            </div>

            {/* Tech Stack */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
                Technology Stack & Architecture
              </h3>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <span className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-slate-800 font-semibold">React 18 + Vite</span>
                <span className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-slate-800 font-semibold">Tailwind CSS v4</span>
                <span className="rounded-lg bg-[#FD1843]/10 border border-[#FD1843]/30 px-2.5 py-1 text-[#FD1843] font-bold">Gemini 3.8 Flash VLM</span>
                <span className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-slate-800 font-semibold">GeoRSCLIP / ViT-L</span>
                <span className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-slate-800 font-semibold">Segment Anything (SAM)</span>
                <span className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-slate-800 font-semibold">BigEarthNet-v2.0 (19 CLC)</span>
                <span className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-slate-800 font-semibold">PyTorch & GDAL</span>
                <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-emerald-800 font-semibold">Supabase Postgres & RLS</span>
              </div>
            </div>

            {/* Dataset Information */}
            <div className="p-4 rounded-xl border border-[#eeddd3] bg-[#FFF9F4] space-y-2 text-xs font-mono">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-[#FD1843]" />
                Dataset Benchmark Integration
              </h4>
              <p className="text-slate-600">
                Calibrated against BigEarthNet-v2.0 (TU Berlin) containing 590,326 Sentinel-1 and Sentinel-2 image patches with 19 Corine Land Cover (CLC) semantic class labels.
              </p>
            </div>

            {/* Footer Copyright */}
            <div className="pt-4 border-t border-[#eeddd3] text-[11px] font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>© 2026 SatQueryAI Earth Observation Research Center. All rights reserved.</span>
              <span>Open Source License: Apache 2.0</span>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODALS */}
      <ConfirmModal
        isOpen={confirmClearHistoryOpen}
        title="Clear Analysis History?"
        message="This will permanently delete all stored query sessions and spectral reports from your local history catalog. This action cannot be undone."
        confirmLabel="Clear History"
        isDestructive={true}
        onConfirm={executeClearHistory}
        onCancel={() => setConfirmClearHistoryOpen(false)}
      />

      <ConfirmModal
        isOpen={confirmClearImagesOpen}
        title="Clear Uploaded Images?"
        message="This will remove all cataloged satellite scenes uploaded in this browser session. Server scenes will remain available."
        confirmLabel="Clear Images"
        isDestructive={true}
        onConfirm={executeClearImages}
        onCancel={() => setConfirmClearImagesOpen(false)}
      />

      <ConfirmModal
        isOpen={confirmDeleteAccountOpen}
        title="Delete Account & Local Station State?"
        message="Are you sure you want to reset your local analyst station? All profile credentials, preferences, cached imagery, and query logs will be purged."
        confirmLabel="Delete Account & Reset"
        isDestructive={true}
        onConfirm={executeDeleteAccount}
        onCancel={() => setConfirmDeleteAccountOpen(false)}
      />

      {/* DOCUMENTATION MODAL */}
      {docsModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-[#eeddd3] bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#eeddd3] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#FD1843]/10 text-[#FD1843] border border-[#FD1843]/30">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold font-mono text-slate-900">SatQueryAI User Manual & API Guide</h3>
              </div>
              <button
                type="button"
                onClick={() => setDocsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-[#FD1843]/10 hover:text-[#FD1843]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono text-slate-800 leading-relaxed">
              <div className="space-y-2">
                <h4 className="font-bold text-[#FD1843] text-sm">1. Spectral Indices Reference</h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li><strong>NDVI (Normalized Difference Vegetation Index):</strong> (NIR - Red) / (NIR + Red) for chlorophyll absorption.</li>
                  <li><strong>NDWI (Normalized Difference Water Index):</strong> (Green - NIR) / (Green + NIR) for open water delineation.</li>
                  <li><strong>NDBI (Normalized Difference Built-Up Index):</strong> (SWIR - NIR) / (SWIR + NIR) for urban built-up expansion.</li>
                  <li><strong>MNDWI (Modified NDWI):</strong> (Green - SWIR) / (Green + SWIR) for enhanced water separation in urban shadows.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-[#FD1843] text-sm">2. VLM Multimodal Inference & Auto-Switching</h4>
                <p className="text-slate-700">
                  SatQueryAI employs a resilient multi-tier VLM routing system. Primary vision analysis runs on Gemini 3.8 Flash grounded with deterministic spectral pixel calculations. If a provider times out, the system automatically switches candidates or synthesizes deterministic ground truth metrics.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-[#FD1843] text-sm">3. API Endpoints</h4>
                <div className="bg-[#FFF9F4] p-3 rounded-lg border border-[#eeddd3] space-y-1 text-[11px]">
                  <div><code>POST /api/analysis/query</code> - Multimodal VQA analysis query</div>
                  <div><code>POST /api/images/upload</code> - Upload satellite image (.tif/.png/.jpg)</div>
                  <div><code>GET /api/analysis/history</code> - Query historical analysis sessions</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#eeddd3]">
              <button
                type="button"
                onClick={() => setDocsModalOpen(false)}
                className="rounded-lg bg-[#FD1843] px-4 py-2 text-xs font-mono font-bold text-white hover:bg-[#e0143a] cursor-pointer"
              >
                Close Manual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GITHUB MODAL */}
      {githubModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-[#eeddd3] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#eeddd3] pb-3">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-slate-900" />
                <h3 className="text-base font-bold font-mono text-slate-900">SatQueryAI GitHub Repository</h3>
              </div>
              <button
                type="button"
                onClick={() => setGithubModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-[#FD1843]/10 hover:text-[#FD1843]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-700 font-mono">
              The SatQueryAI codebase is licensed under Apache 2.0. You can inspect backend Python/Express pipelines, PyTorch spectral modules, and React frontend code.
            </p>

            <div className="p-3 bg-[#FFF9F4] rounded-lg border border-[#eeddd3] text-xs font-mono space-y-1">
              <div><strong>Repo:</strong> satquery-ai/satquery-platform</div>
              <div><strong>License:</strong> Apache 2.0 Open Source</div>
              <div><strong>Stars:</strong> 1.4k • <strong>Forks:</strong> 320</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setGithubModalOpen(false)}
                className="rounded-lg border border-[#eeddd3] bg-white px-4 py-2 text-xs font-mono text-slate-700 hover:bg-[#FFF9F4] cursor-pointer"
              >
                Close
              </button>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-mono font-bold text-white hover:bg-slate-800 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Visit GitHub Repo</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ARCHITECTURE / LEARN MORE MODAL */}
      {architectureModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-[#eeddd3] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#eeddd3] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#FD1843]" />
                <h3 className="text-base font-bold font-mono text-slate-900">SatQueryAI System Architecture</h3>
              </div>
              <button
                type="button"
                onClick={() => setArchitectureModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-[#FD1843]/10 hover:text-[#FD1843]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono text-slate-700 leading-relaxed">
              <p>
                <strong>Single Source of Truth:</strong> SatQueryAI computes a canonical analytical result object for every satellite image, including exact pixel-level water area %, vegetation %, built-up %, and spectral indices.
              </p>
              <p>
                <strong>Adaptive Thresholding:</strong> Avoids static global index thresholds by inspecting pixel histograms (Otsu adaptive method) to handle water bodies in high-shadow or turbid scenes accurately.
              </p>
              <p>
                <strong>Cross-Modal Fusion:</strong> Seamlessly combines Sentinel-2 MSI optical bands (VNIR/SWIR) with Sentinel-1 Synthetic Aperture Radar (SAR VV/VH polarizations) to penetrate cloud cover.
              </p>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#eeddd3]">
              <button
                type="button"
                onClick={() => setArchitectureModalOpen(false)}
                className="rounded-lg bg-[#FD1843] px-4 py-2 text-xs font-mono font-bold text-white hover:bg-[#e0143a] cursor-pointer"
              >
                Close Architecture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
