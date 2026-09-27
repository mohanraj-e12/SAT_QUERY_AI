import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';
import { AuthPage } from './pages/AuthPage.js';
import { Project, SatelliteImage, AnalysisSession, Alert, UserProfile } from './types/index.js';
import { projectService } from './services/project.service.js';
import { imageService } from './services/image.service.js';
import { analysisService } from './services/analysis.service.js';
import { alertService } from './services/alert.service.js';
import { authService } from './services/auth.service.js';

import { Navbar } from './components/Navbar.js';
import { Sidebar, NavigationTab } from './components/Sidebar.js';
import { NewProjectModal } from './components/NewProjectModal.js';

import { DashboardPage } from './pages/DashboardPage.js';
import { GeoScopePage } from './pages/GeoScopePage.js';
import { ExplorePage } from './pages/ExplorePage.js';
import { AssistantPage, type QAItem } from './pages/AssistantPage.js';
import { ChangeDetectionPage } from './pages/ChangeDetectionPage.js';
import { ModelLabPage } from './pages/ModelLabPage.js';
import { SpecializedAnalysisPage, AnalysisFeatureMode } from './pages/SpecializedAnalysisPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { settingsService } from './services/settings.service.js';

function formatNameFromEmail(email: string): string {
  if (!email) return 'Analyst';
  const prefix = email.split('@')[0];
  const cleaned = prefix.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'Analyst';
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function App() {
  // Authentication Guard State
  const [session, setSession] = useState<Session | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Application Workspace State
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [images, setImages] = useState<SatelliteImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<SatelliteImage | null>(null);
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [assistantQaHistory, setAssistantQaHistory] = useState<QAItem[]>([]);
  const [assistantCurrentSession, setAssistantCurrentSession] = useState<AnalysisSession | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize and listen to Supabase Auth state
  useEffect(() => {
    let isMounted = true;

    async function checkAuthSession() {
      if (!isSupabaseConfigured() || !supabase) {
        if (isMounted) setAuthChecking(false);
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[Supabase Auth GetSession Error]', error);
        }
        if (isMounted) {
          setSession(data?.session || null);
          setAuthChecking(false);
        }
      } catch (err) {
        console.warn('[Supabase Session Init Exception]', err);
        if (isMounted) {
          setAuthChecking(false);
        }
      }

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
        if (isMounted) {
          setSession(currentSession);
          setAuthChecking(false);
        }
      });

      return () => {
        authListener?.subscription?.unsubscribe();
      };
    }

    const unsubPromise = checkAuthSession();

    return () => {
      isMounted = false;
      unsubPromise.then((unsub) => unsub && unsub());
    };
  }, []);

  // Load application data only after authentication is confirmed
  useEffect(() => {
    if (!session) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [projRes, imgRes, histRes, alertRes, authRes] = await Promise.allSettled([
          projectService.getProjects(),
          imageService.getImages(),
          analysisService.getHistory(),
          alertService.getAlerts(),
          authService.getProfile(),
        ]);

        if (!isMounted) return;

        if (projRes.status === 'fulfilled') {
          setProjects(projRes.value);
          if (projRes.value.length > 0) {
            setActiveProject(projRes.value[0]);
          }
        }

        if (imgRes.status === 'fulfilled') {
          setImages(imgRes.value);
          if (imgRes.value.length > 0) {
            setSelectedImage(imgRes.value[0]);
          }
        }

        if (histRes.status === 'fulfilled') {
          const orderedHistory = [...histRes.value].sort(
            (first, second) =>
              new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
          );
          setSessions(orderedHistory);
          const imagesById = new Map(
            (imgRes.status === 'fulfilled' ? imgRes.value : []).map((image) => [image.id, image])
          );
          setAssistantQaHistory(
            orderedHistory.map((analysis) => {
              const image = imagesById.get(analysis.image_id);
              return {
                id: analysis.id,
                imageId: analysis.image_id,
                imageFileName: image?.file_name || 'Satellite image',
                imageSatellite: image?.satellite || 'Satellite image',
                question: analysis.query,
                timestamp: new Date(analysis.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                session: analysis,
                expandedDetails: false,
              };
            })
          );
          setAssistantCurrentSession(orderedHistory[0] || null);
        }

        if (alertRes.status === 'fulfilled') {
          setAlerts(alertRes.value);
        }

        const userEmail = session.user?.email || '';
        const derivedName = formatNameFromEmail(userEmail);

        if (authRes.status === 'fulfilled') {
          const profile = authRes.value.profile;
          if (userEmail) {
            profile.email = userEmail;
          }
          // Remove Dr. Vikramaditya Sharma and set name from user email
          if (
            !profile.full_name ||
            profile.full_name.includes('Vikramaditya') ||
            profile.full_name.includes('Sharma')
          ) {
            profile.full_name = derivedName;
          }
          // Remove default profile photo so default icon is shown
          if (profile.avatar_url && profile.avatar_url.includes('unsplash.com')) {
            profile.avatar_url = '';
          }
          setUser(profile);
          setSupabaseConnected(authRes.value.supabaseConnected || true);
        } else if (userEmail) {
          setUser({
            id: session.user.id,
            email: userEmail,
            full_name: derivedName,
            avatar_url: '',
            role: (session.user.user_metadata?.role as string) || 'Lead Analyst',
            organization: (session.user.user_metadata?.organization as string) || 'Earth Observation Center',
            preferences: {},
            created_at: new Date().toISOString(),
          });
          setSupabaseConnected(true);
        }
      } catch (err) {
        console.warn('[SatQuery] Error bootstrapping initial state:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    // Apply saved appearance settings on startup
    const settings = settingsService.getSettings();
    settingsService.applyAppearanceSettings(settings.appearance);

    return () => {
      isMounted = false;
    };
  }, [session]);

  const handleSignOut = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[Supabase SignOut error]', err);
      }
    }
    setSession(null);
    setUser(null);
  };

  // Auth Loading State (Prevents exposing protected workspace before redirecting)
  if (authChecking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFF9F4] font-mono text-slate-700">
        <div className="flex items-center gap-3 rounded-2xl border border-[#eeddd3] bg-white px-6 py-4 shadow-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FD1843] border-t-transparent" />
          <span className="text-xs font-semibold tracking-wide text-slate-800">
            Checking authentication...
          </span>
        </div>
      </div>
    );
  }

  // Protected route guard: If no active Supabase session, show Auth Page
  if (!session) {
    return (
      <AuthPage
        onAuthSuccess={async () => {
          if (supabase) {
            const { data } = await supabase.auth.getSession();
            if (data?.session) {
              setSession(data.session);
            }
          }
        }}
      />
    );
  }

  const unreadAlertsCount = alerts.filter((a) => !a.is_read).length;

  const handleSelectImageForAssistant = (img: SatelliteImage, customPrompt?: string) => {
    setSelectedImage(img);
    setCurrentTab('assistant');
  };

  const handleSelectImageForMap = (img: SatelliteImage) => {
    setSelectedImage(img);
    setCurrentTab('explore');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF9F4] font-sans text-slate-900 antialiased selection:bg-[#FD1843] selection:text-white">
      {/* Top Navigation */}
      <Navbar
        projects={projects}
        activeProject={activeProject}
        onSelectProject={setActiveProject}
        onOpenNewProject={() => setNewProjectModalOpen(true)}
        user={user}
        unreadAlertCount={unreadAlertsCount}
        onOpenAlerts={() => setCurrentTab('water-vegetation')}
        onOpenSettings={() => setCurrentTab('settings')}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onSignOut={handleSignOut}
        supabaseConnected={supabaseConnected}
        currentTab={currentTab}
      />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Persistent Collapsible Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          unreadAlertsCount={unreadAlertsCount}
        />

        {/* Dynamic Page Stage */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-7xl">
            {currentTab === 'dashboard' && (
              <DashboardPage
                projects={projects}
                images={images}
                sessions={sessions}
                alerts={alerts}
                onNavigate={setCurrentTab}
                onSelectImageForAssistant={handleSelectImageForAssistant}
              />
            )}

            {currentTab === 'geoscope' && (
              <GeoScopePage
                onNavigateToAssistant={handleSelectImageForAssistant}
              />
            )}

            {currentTab === 'explore' && (
              <ExplorePage
                images={images}
                activeProject={activeProject}
                onSelectImageForAssistant={handleSelectImageForAssistant}
              />
            )}

            {currentTab === 'assistant' && (
              <AssistantPage
                images={images}
                selectedImage={selectedImage}
                onSelectImage={setSelectedImage}
                activeProject={activeProject}
                projects={projects}
                qaHistory={assistantQaHistory}
                currentSession={assistantCurrentSession}
                onQAHistoryChange={setAssistantQaHistory}
                onCurrentSessionChange={setAssistantCurrentSession}
                onSessionCreated={(s) => {
                  setSessions((previous) => [s, ...previous.filter((item) => item.id !== s.id)]);
                  const image = images.find((item) => item.id === s.image_id) ||
                    (selectedImage?.id === s.image_id ? selectedImage : null);
                  setAssistantQaHistory((previous) => [
                    {
                      id: s.id,
                      imageId: s.image_id,
                      imageFileName: image?.file_name || 'Satellite image',
                      imageSatellite: image?.satellite || 'Satellite image',
                      question: s.query,
                      timestamp: new Date(s.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                      session: s,
                      expandedDetails: false,
                    },
                    ...previous.filter((item) => item.id !== s.id),
                  ]);
                  setAssistantCurrentSession(s);
                }}
                onImageUploaded={(img) => {
                  setImages([img, ...images]);
                  setSelectedImage(img);
                }}
              />
            )}

            {currentTab === 'change-detection' && (
              <ChangeDetectionPage
                images={images}
                activeProject={activeProject}
              />
            )}

            {currentTab === 'model-lab' && (
              <ModelLabPage />
            )}

            {/* 1. Land Cover Classification */}
            {currentTab === 'land-cover' && (
              <SpecializedAnalysisPage
                mode="land-cover"
                images={images}
                activeProject={activeProject}
                onNavigateToAssistant={handleSelectImageForAssistant}
                onSelectImage={setSelectedImage}
              />
            )}

            {/* 2. Object Detection */}
            {currentTab === 'object-detection' && (
              <SpecializedAnalysisPage
                mode="object-detection"
                images={images}
                activeProject={activeProject}
                onNavigateToAssistant={handleSelectImageForAssistant}
                onSelectImage={setSelectedImage}
              />
            )}

            {/* 3. Disaster Analysis */}
            {currentTab === 'disaster-analysis' && (
              <SpecializedAnalysisPage
                mode="disaster-analysis"
                images={images}
                activeProject={activeProject}
                onNavigateToAssistant={handleSelectImageForAssistant}
                onSelectImage={setSelectedImage}
              />
            )}

            {/* 4. Agriculture Analysis */}
            {currentTab === 'agriculture-analysis' && (
              <SpecializedAnalysisPage
                mode="agriculture-analysis"
                images={images}
                activeProject={activeProject}
                onNavigateToAssistant={handleSelectImageForAssistant}
                onSelectImage={setSelectedImage}
              />
            )}

            {/* 5. Urban Growth Analysis */}
            {currentTab === 'urban-growth' && (
              <SpecializedAnalysisPage
                mode="urban-growth"
                images={images}
                activeProject={activeProject}
                onNavigateToAssistant={handleSelectImageForAssistant}
                onSelectImage={setSelectedImage}
              />
            )}

            {/* 6. Water & Vegetation Analysis */}
            {currentTab === 'water-vegetation' && (
              <SpecializedAnalysisPage
                mode="water-vegetation"
                images={images}
                activeProject={activeProject}
                onNavigateToAssistant={handleSelectImageForAssistant}
                onSelectImage={setSelectedImage}
              />
            )}

            {/* 7. Settings Page */}
            {currentTab === 'settings' && (
              <SettingsPage
                user={user}
                supabaseConnected={supabaseConnected}
                onProfileUpdated={(updated) => setUser(updated)}
                sessions={sessions}
                projects={projects}
                images={images}
                onClearHistory={() => setSessions([])}
                onClearImages={() => {
                  setImages([]);
                  setSelectedImage(null);
                }}
                onSignOut={handleSignOut}
              />
            )}
          </div>
        </main>
      </div>

      {/* Global New Project Modal */}
      <NewProjectModal
        isOpen={newProjectModalOpen}
        onClose={() => setNewProjectModalOpen(false)}
        onCreated={(p) => {
          setProjects([p, ...projects]);
          setActiveProject(p);
        }}
      />
    </div>
  );
}

export default App;
