-- SatQuery AI: Production Development Seed Data
-- Seed projects, real satellite imagery catalog entries, historical sessions, and alerts

-- Sample Project 1: Delhi-NCR Urban Expansion & Green Cover Study
INSERT INTO public.projects (id, user_id, name, description, aoi, tags)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '00000000-0000-0000-0000-000000000001',
    'Delhi-NCR Urban Sprawl & Green Cover Assessment',
    'Longitudinal remote sensing analysis tracking urban built-up expansion (NDBI) and canopy decrease (NDVI) across the National Capital Region.',
    '{"type": "Polygon", "coordinates": [[[76.85, 28.40], [77.35, 28.40], [77.35, 28.85], [76.85, 28.85], [76.85, 28.40]]]}',
    ARRAY['Urbanization', 'NDBI', 'NDVI', 'Sentinel-2']
) ON CONFLICT DO NOTHING;

-- Sample Project 2: Himalayan Glacial Lake Outburst Flood (GLOF) Monitoring
INSERT INTO public.projects (id, user_id, name, description, aoi, tags)
VALUES (
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    '00000000-0000-0000-0000-000000000001',
    'Sikkim-Teesta Glacial Lake Monitoring (GLOF Risk)',
    'High-altitude multispectral lake surface area tracking (NDWI) and moraine dam stability assessment.',
    '{"type": "Polygon", "coordinates": [[[88.10, 27.70], [88.55, 27.70], [88.55, 28.10], [88.10, 28.10], [88.10, 27.70]]]}',
    ARRAY['Cryosphere', 'NDWI', 'Disaster Risk', 'Landsat-9']
) ON CONFLICT DO NOTHING;

-- Sample Satellite Imagery
INSERT INTO public.satellite_images (
    id, project_id, user_id, file_name, file_url, storage_path, source, satellite, sensor, acquisition_date, cloud_percentage, resolution_meters, bands, latitude, longitude, bbox, metadata
) VALUES 
(
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '00000000-0000-0000-0000-000000000001',
    'S2A_MSIL2A_20251115_DELHI_NCR_RGB.jpg',
    'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1600&q=80',
    'satellite-images/00000000-0000-0000-0000-000000000001/delhi_2025.jpg',
    'Copernicus Open Access Hub',
    'Sentinel-2A',
    'MSI (MultiSpectral Instrument)',
    '2025-11-15',
    1.2,
    10.0,
    ARRAY['B2 (Blue)', 'B3 (Green)', 'B4 (Red)', 'B8 (NIR)', 'B11 (SWIR)'],
    28.6139,
    77.2090,
    '{"west": 76.85, "south": 28.40, "east": 77.35, "north": 28.85}',
    '{"crs": "EPSG:4326", "sun_elevation": 42.6, "radiometric_calibration": "BOA_Reflectance"}'
),
(
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '00000000-0000-0000-0000-000000000001',
    'S2B_MSIL2A_20260210_DELHI_NCR_RGB.jpg',
    'https://images.unsplash.com/photo-1524813686514-a57563d77d66?auto=format&fit=crop&w=1600&q=80',
    'satellite-images/00000000-0000-0000-0000-000000000001/delhi_2026.jpg',
    'Copernicus Open Access Hub',
    'Sentinel-2B',
    'MSI',
    '2026-02-10',
    0.8,
    10.0,
    ARRAY['B2', 'B3', 'B4', 'B8', 'B11'],
    28.6139,
    77.2090,
    '{"west": 76.85, "south": 28.40, "east": 77.35, "north": 28.85}',
    '{"crs": "EPSG:4326", "sun_elevation": 48.1, "radiometric_calibration": "BOA_Reflectance"}'
),
(
    'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    '00000000-0000-0000-0000-000000000001',
    'LC09_L2SP_20251020_SIKKIM_GLACIER.jpg',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
    'satellite-images/00000000-0000-0000-0000-000000000001/sikkim_glacier.jpg',
    'USGS EarthExplorer',
    'Landsat-9',
    'OLI-2 / TIRS-2',
    '2025-10-20',
    2.5,
    30.0,
    ARRAY['B2', 'B3', 'B4', 'B5 (NIR)', 'B6 (SWIR-1)'],
    27.8500,
    88.3200,
    '{"west": 88.10, "south": 27.70, "east": 88.55, "north": 28.10}',
    '{"crs": "EPSG:4326", "sun_elevation": 39.4}'
) ON CONFLICT DO NOTHING;

-- Sample Alerts
INSERT INTO public.alerts (id, user_id, project_id, title, message, alert_type, severity, is_read)
VALUES
(
    'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
    '00000000-0000-0000-0000-000000000001',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Urban Expansion Detected (+8.7%)',
    'NDBI spectral anomaly indicated +8.7% new built-up area and road infrastructure along Dwarka Expressway corridor.',
    'URBAN_EXPANSION',
    'medium',
    false
),
(
    '06eebc99-9c0b-4ef8-bb6d-6bb9bd380a77',
    '00000000-0000-0000-0000-000000000001',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Vegetation Canopy Loss (-5.2%)',
    'NDVI calculation identified localized deforestation and tree canopy reduction in the southern ridge buffer zone.',
    'VEGETATION_DECREASE',
    'high',
    false
),
(
    '17eebc99-9c0b-4ef8-bb6d-6bb9bd380a88',
    '00000000-0000-0000-0000-000000000001',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'Glacial Lake Surface Expansion (+14.3%)',
    'NDWI index confirmed expanding moraine lake perimeter following early thaw cycle.',
    'WATER_ANOMALY',
    'critical',
    false
) ON CONFLICT DO NOTHING;
