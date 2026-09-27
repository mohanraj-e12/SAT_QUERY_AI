import { UserProfile } from '../types/index.js';

export interface AppSettings {
  profile: {
    fullName: string;
    email: string;
    organization: string;
    role: string;
    accountType: 'Enterprise' | 'Researcher' | 'Pro' | 'Free Tier';
    avatarUrl: string;
  };
  aiAnalysis: {
    analysisMode: 'quick' | 'detailed' | 'expert';
    responseDetail: 'short' | 'medium' | 'detailed';
    visualEvidence: boolean;
    confidenceScore: boolean;
    explanationToggle: boolean;
  };
  remoteSensing: {
    defaultImageType: 'optical' | 'sar' | 'multispectral' | 'hyperspectral';
    defaultAnalysisTask: 'land-cover' | 'change-detection' | 'disaster-analysis' | 'agriculture-analysis' | 'urban-growth' | 'water-vegetation';
    coordinateSystem: 'EPSG:4326' | 'EPSG:3857' | 'UTM Zone 33N' | 'MGRS';
    defaultMapLayer: 'sentinel-2-true' | 'sentinel-2-false' | 'sentinel-1-sar' | 'landsat-8-9' | 'high-res-sat';
    autoPreprocessing: boolean;
  };
  mapSettings: {
    defaultMapStyle: 'satellite' | 'street' | 'terrain';
    showCoordinates: boolean;
    showScale: boolean;
    locationMarkers: boolean;
    analysisBoundaryOverlay: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
    interfaceDensity: 'compact' | 'comfortable';
    sidebarCollapsed: boolean;
    animationsEnabled: boolean;
  };
  notifications: {
    analysisCompleted: boolean;
    analysisFailed: boolean;
    processingStatus: boolean;
    systemNotifications: boolean;
  };
  privacyData: {
    dataRetention: '30_days' | '90_days' | '1_year' | 'indefinite';
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  profile: {
    fullName: '',
    email: '',
    organization: '',
    role: '',
    accountType: 'Enterprise',
    avatarUrl: '',
  },
  aiAnalysis: {
    analysisMode: 'detailed',
    responseDetail: 'medium',
    visualEvidence: true,
    confidenceScore: true,
    explanationToggle: true,
  },
  remoteSensing: {
    defaultImageType: 'multispectral',
    defaultAnalysisTask: 'land-cover',
    coordinateSystem: 'EPSG:4326',
    defaultMapLayer: 'sentinel-2-true',
    autoPreprocessing: true,
  },
  mapSettings: {
    defaultMapStyle: 'satellite',
    showCoordinates: true,
    showScale: true,
    locationMarkers: true,
    analysisBoundaryOverlay: true,
  },
  appearance: {
    theme: 'light',
    interfaceDensity: 'comfortable',
    sidebarCollapsed: false,
    animationsEnabled: true,
  },
  notifications: {
    analysisCompleted: true,
    analysisFailed: true,
    processingStatus: true,
    systemNotifications: true,
  },
  privacyData: {
    dataRetention: '90_days',
  },
};

const SETTINGS_STORAGE_KEY = 'satquery_app_settings_v1';

export const settingsService = {
  getSettings: (): AppSettings => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw);
      return {
        profile: { ...DEFAULT_SETTINGS.profile, ...(parsed.profile || {}) },
        aiAnalysis: { ...DEFAULT_SETTINGS.aiAnalysis, ...(parsed.aiAnalysis || {}) },
        remoteSensing: { ...DEFAULT_SETTINGS.remoteSensing, ...(parsed.remoteSensing || {}) },
        mapSettings: { ...DEFAULT_SETTINGS.mapSettings, ...(parsed.mapSettings || {}) },
        appearance: { ...DEFAULT_SETTINGS.appearance, ...(parsed.appearance || {}) },
        notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications || {}) },
        privacyData: { ...DEFAULT_SETTINGS.privacyData, ...(parsed.privacyData || {}) },
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings: (settings: AppSettings): void => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      settingsService.applyAppearanceSettings(settings.appearance);
    } catch (e) {
      console.warn('[SettingsService] Failed to save settings to localStorage:', e);
    }
  },

  updateSection: <K extends keyof AppSettings>(section: K, data: Partial<AppSettings[K]>): AppSettings => {
    const current = settingsService.getSettings();
    const updated: AppSettings = {
      ...current,
      [section]: {
        ...current[section],
        ...data,
      },
    };
    settingsService.saveSettings(updated);
    return updated;
  },

  applyAppearanceSettings: (appearance: AppSettings['appearance']): void => {
    const root = document.documentElement;

    // Theme handling
    if (appearance.theme === 'dark') {
      root.classList.add('dark');
    } else if (appearance.theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System mode
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isSystemDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    // Density
    root.setAttribute('data-density', appearance.interfaceDensity);

    // Animations
    if (!appearance.animationsEnabled) {
      root.classList.add('no-animations');
    } else {
      root.classList.remove('no-animations');
    }
  },

  exportDataJSON: (sessions: any[], projects: any[], images: any[]): void => {
    const settings = settingsService.getSettings();
    const exportObject = {
      app: 'SatQueryAI',
      version: '2.4.0',
      exported_at: new Date().toISOString(),
      user_profile: settings.profile,
      settings,
      projects_count: projects.length,
      projects,
      images_count: images.length,
      images: images.map((i) => ({
        id: i.id,
        file_name: i.file_name,
        satellite: i.satellite,
        sensor: i.sensor,
        acquisition_date: i.acquisition_date,
        latitude: i.latitude,
        longitude: i.longitude,
      })),
      analysis_sessions_count: sessions.length,
      analysis_sessions: sessions,
    };

    const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SatQueryAI_Data_Export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
