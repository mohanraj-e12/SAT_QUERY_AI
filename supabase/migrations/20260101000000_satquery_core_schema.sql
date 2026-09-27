-- SatQuery AI: Core Database Schema Migration
-- Multimodal Remote-Sensing Intelligence Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    organization TEXT DEFAULT 'Geospatial Research Lab',
    role TEXT DEFAULT 'remote_sensing_analyst',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    aoi JSONB, -- GeoJSON Polygon or FeatureCollection
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SATELLITE IMAGES TABLE
CREATE TABLE IF NOT EXISTS public.satellite_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'User Upload',
    satellite TEXT NOT NULL DEFAULT 'Sentinel-2',
    sensor TEXT DEFAULT 'MSI',
    acquisition_date DATE DEFAULT CURRENT_DATE,
    cloud_percentage NUMERIC(5, 2) DEFAULT 0.0,
    resolution_meters NUMERIC(6, 2) DEFAULT 10.0,
    bands TEXT[] DEFAULT ARRAY['B2', 'B3', 'B4', 'B8']::TEXT[],
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    bbox JSONB, -- [minX, minY, maxX, maxY]
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ANALYSIS SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.analysis_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    image_id UUID REFERENCES public.satellite_images(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    analysis_type TEXT NOT NULL, -- 'VEGETATION', 'WATER_DETECTION', 'OBJECT_DETECTION', 'BUILT_UP_ANALYSIS', 'CHANGE_DETECTION', 'IMAGE_DESCRIPTION'
    result JSONB NOT NULL,
    confidence NUMERIC(4, 3) DEFAULT 0.90,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ANALYSIS RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,
    result_type TEXT NOT NULL,
    result_data JSONB NOT NULL,
    image_url TEXT,
    geojson JSONB,
    statistics JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- 'CHANGE_DETECTED', 'VEGETATION_DECREASE', 'WATER_ANOMALY', 'URBAN_EXPANSION'
    severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SAVED QUERIES TABLE
CREATE TABLE IF NOT EXISTS public.saved_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR HIGH-PERFORMANCE GEOSPATIAL SEARCHES
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_images_project_id ON public.satellite_images(project_id);
CREATE INDEX IF NOT EXISTS idx_images_user_id ON public.satellite_images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_satellite ON public.satellite_images(satellite);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.analysis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_image_id ON public.analysis_sessions(image_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id_unread ON public.alerts(user_id) WHERE is_read = FALSE;

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.satellite_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_queries ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Projects Policies
CREATE POLICY "Users can manage own projects" ON public.projects
    FOR ALL USING (auth.uid() = user_id);

-- Satellite Images Policies
CREATE POLICY "Users can manage own images" ON public.satellite_images
    FOR ALL USING (auth.uid() = user_id);

-- Analysis Sessions Policies
CREATE POLICY "Users can manage own sessions" ON public.analysis_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Analysis Results Policies
CREATE POLICY "Users can view own analysis results" ON public.analysis_results
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.analysis_sessions
            WHERE analysis_sessions.id = analysis_results.session_id
            AND analysis_sessions.user_id = auth.uid()
        )
    );

-- Alerts Policies
CREATE POLICY "Users can manage own alerts" ON public.alerts
    FOR ALL USING (auth.uid() = user_id);

-- Saved Queries Policies
CREATE POLICY "Users can manage own saved queries" ON public.saved_queries
    FOR ALL USING (auth.uid() = user_id);

-- STORAGE BUCKETS SETUP
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('satellite-images', 'satellite-images', false),
    ('analysis-results', 'analysis-results', false),
    ('user-assets', 'user-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Authenticated users can upload satellite images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'satellite-images' AND auth.uid() = (storage.foldername(name))[1]::uuid);

CREATE POLICY "Users can read own satellite images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'satellite-images' AND auth.uid() = (storage.foldername(name))[1]::uuid);
