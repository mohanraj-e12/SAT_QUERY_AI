import {
  UserProfile,
  Project,
  SatelliteImage,
  AnalysisSession,
  AnalysisResultRecord,
  Alert,
  SavedQuery,
} from '../models/types.js';

// Pre-seeded initial records matching seed.sql
const initialUser: UserProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  user_id: '00000000-0000-0000-0000-000000000001',
  full_name: '',
  email: '',
  avatar_url: '',
  organization: 'National Centre for Earth Observation & Geospatial AI',
  role: 'Lead Remote Sensing Scientist',
  created_at: new Date('2025-01-01').toISOString(),
  updated_at: new Date().toISOString(),
};

const initialProjects: Project[] = [
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    user_id: initialUser.user_id,
    name: 'Delhi-NCR Urban Sprawl & Green Cover Assessment',
    description: 'Longitudinal remote sensing analysis tracking urban built-up expansion (NDBI) and canopy decrease (NDVI) across the National Capital Region.',
    aoi: {
      type: 'Polygon',
      coordinates: [
        [
          [76.85, 28.40],
          [77.35, 28.40],
          [77.35, 28.85],
          [76.85, 28.85],
          [76.85, 28.40],
        ],
      ],
    },
    tags: ['Urbanization', 'NDBI', 'NDVI', 'Sentinel-2'],
    created_at: new Date('2025-11-01').toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    user_id: initialUser.user_id,
    name: 'Sikkim-Teesta Glacial Lake Monitoring (GLOF Risk)',
    description: 'High-altitude multispectral lake surface area tracking (NDWI) and moraine dam stability assessment.',
    aoi: {
      type: 'Polygon',
      coordinates: [
        [
          [88.10, 27.70],
          [88.55, 27.70],
          [88.55, 28.10],
          [88.10, 28.10],
          [88.10, 27.70],
        ],
      ],
    },
    tags: ['Cryosphere', 'NDWI', 'Disaster Risk', 'Landsat-9'],
    created_at: new Date('2025-10-15').toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    user_id: initialUser.user_id,
    name: 'Godavari Delta Agricultural Crop Health Monitor',
    description: 'Irrigated paddy field phenology, vegetation vigor index, and seasonal waterlogged soil mapping.',
    aoi: {
      type: 'Polygon',
      coordinates: [
        [
          [81.70, 16.45],
          [82.35, 16.45],
          [82.35, 17.15],
          [81.70, 17.15],
          [81.70, 16.45],
        ],
      ],
    },
    tags: ['Agriculture', 'Paddy', 'NDVI', 'LISS-4'],
    created_at: new Date('2025-12-05').toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    user_id: initialUser.user_id,
    name: 'ISRO/SAC Benchmark: Co-Registered Cartosat-2S & RISAT SAR',
    description: 'Joint cross-modal evaluation set with sub-meter Cartosat-2S optical pan-sharpened and RISAT-1A C-band dual-pol SAR imagery.',
    aoi: {
      type: 'Polygon',
      coordinates: [
        [
          [77.10, 28.50],
          [77.30, 28.50],
          [77.30, 28.70],
          [77.10, 28.70],
          [77.10, 28.50],
        ],
      ],
    },
    tags: ['ISRO/SAC', 'Cartosat-2S', 'RISAT-1A', 'Cross-Modal', 'SAR Fusion'],
    created_at: new Date('2026-01-10').toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const initialImages: SatelliteImage[] = [
  {
    id: 'img-delhi-2025',
    project_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    user_id: initialUser.user_id,
    file_name: 'S2A_MSIL2A_20251115_DELHI_NCR_RGB.jpg',
    file_url: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1600&q=80',
    storage_path: 'satellite-images/delhi_2025.jpg',
    source: 'Copernicus Open Access Hub',
    satellite: 'Sentinel-2A',
    sensor: 'MSI (MultiSpectral Instrument)',
    acquisition_date: '2025-11-15',
    cloud_percentage: 1.2,
    resolution_meters: 10.0,
    bands: ['B2 (Blue)', 'B3 (Green)', 'B4 (Red)', 'B8 (NIR)', 'B11 (SWIR)'],
    latitude: 28.6139,
    longitude: 77.2090,
    bbox: { west: 76.85, south: 28.40, east: 77.35, north: 28.85 },
    metadata: {
      crs: 'EPSG:4326',
      sun_elevation: 42.6,
      radiometric_calibration: 'BOA_Reflectance',
      processing_level: 'Level-2A Bottom-Of-Atmosphere',
    },
    created_at: new Date('2025-11-16').toISOString(),
  },
  {
    id: 'img-delhi-2026',
    project_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    user_id: initialUser.user_id,
    file_name: 'S2B_MSIL2A_20260210_DELHI_NCR_RGB.jpg',
    file_url: 'https://images.unsplash.com/photo-1524813686514-a57563d77d66?auto=format&fit=crop&w=1600&q=80',
    storage_path: 'satellite-images/delhi_2026.jpg',
    source: 'Copernicus Open Access Hub',
    satellite: 'Sentinel-2B',
    sensor: 'MSI',
    acquisition_date: '2026-02-10',
    cloud_percentage: 0.8,
    resolution_meters: 10.0,
    bands: ['B2', 'B3', 'B4', 'B8', 'B11'],
    latitude: 28.6139,
    longitude: 77.2090,
    bbox: { west: 76.85, south: 28.40, east: 77.35, north: 28.85 },
    metadata: {
      crs: 'EPSG:4326',
      sun_elevation: 48.1,
      radiometric_calibration: 'BOA_Reflectance',
      processing_level: 'Level-2A',
    },
    created_at: new Date('2026-02-11').toISOString(),
  },
  {
    id: 'img-sikkim-2025',
    project_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    user_id: initialUser.user_id,
    file_name: 'LC09_L2SP_20251020_SIKKIM_GLACIER.jpg',
    file_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
    storage_path: 'satellite-images/sikkim_glacier.jpg',
    source: 'USGS EarthExplorer',
    satellite: 'Landsat-9',
    sensor: 'OLI-2 / TIRS-2',
    acquisition_date: '2025-10-20',
    cloud_percentage: 2.5,
    resolution_meters: 30.0,
    bands: ['B2', 'B3', 'B4', 'B5 (NIR)', 'B6 (SWIR-1)'],
    latitude: 27.8500,
    longitude: 88.3200,
    bbox: { west: 88.10, south: 27.70, east: 88.55, north: 28.10 },
    metadata: {
      crs: 'EPSG:4326',
      sun_elevation: 39.4,
      processing_level: 'Collection-2 Level-2 Surface Reflectance',
    },
    created_at: new Date('2025-10-21').toISOString(),
  },
  {
    id: 'img-godavari-2025',
    project_id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    user_id: initialUser.user_id,
    file_name: 'RS2A_LISS4_20251201_GODAVARI_DELTA.jpg',
    file_url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80',
    storage_path: 'satellite-images/godavari.jpg',
    source: 'ISRO Bhuvan Open Data',
    satellite: 'Resourcesat-2A',
    sensor: 'LISS-4 (Linear Imaging Self-Scanning Sensor)',
    acquisition_date: '2025-12-01',
    cloud_percentage: 0.4,
    resolution_meters: 5.8,
    bands: ['B2 (Green)', 'B3 (Red)', 'B4 (NIR)'],
    latitude: 16.8500,
    longitude: 82.0500,
    bbox: { west: 81.70, south: 16.45, east: 82.35, north: 17.15 },
    metadata: {
      crs: 'EPSG:4326',
      sun_elevation: 45.2,
      processing_level: 'Standard Ortho-rectified',
    },
    created_at: new Date('2025-12-02').toISOString(),
  },
  {
    id: 'img-cartosat-optical',
    project_id: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    user_id: initialUser.user_id,
    file_name: 'CS2S_PAN_MS_20251115_DELHI_CENTRAL.tif',
    file_url: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1600&q=80',
    storage_path: 'satellite-images/cartosat_delhi.tif',
    source: 'ISRO Space Applications Centre (SAC)',
    satellite: 'Cartosat-2S',
    sensor: 'High-Resolution Panchromatic & Multispectral (PAN/MS)',
    acquisition_date: '2025-11-15',
    cloud_percentage: 0.5,
    resolution_meters: 0.65,
    bands: ['Band 1 (Blue)', 'Band 2 (Green)', 'Band 3 (Red)', 'Band 4 (NIR)', 'PAN (0.65m)'],
    latitude: 28.6139,
    longitude: 77.2090,
    bbox: { west: 77.10, south: 28.50, east: 77.30, north: 28.70 },
    metadata: {
      crs: 'EPSG:4326',
      modality: 'OPTICAL_MULTISPECTRAL',
      format: 'GeoTIFF',
      sun_elevation: 44.2,
      processing_level: 'Level-2B Precision Georeferenced',
      co_registered_pair_id: 'img-risat-sar',
    },
    created_at: new Date('2026-01-11').toISOString(),
  },
  {
    id: 'img-risat-sar',
    project_id: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    user_id: initialUser.user_id,
    file_name: 'RISAT1A_FRS1_20251115_DELHI_SAR_DUAL.tif',
    file_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
    storage_path: 'satellite-images/risat_delhi_sar.tif',
    source: 'ISRO Space Applications Centre (SAC)',
    satellite: 'RISAT-1A (EOS-04)',
    sensor: 'C-Band Synthetic Aperture Radar (FRS-1 Fine Resolution)',
    acquisition_date: '2025-11-15',
    cloud_percentage: 0.0,
    resolution_meters: 1.0,
    bands: ['RH (Right Circular - Horizontal)', 'RV (Right Circular - Vertical)', 'Stokes Parameters (S0, S1, S2, S3)'],
    latitude: 28.6139,
    longitude: 77.2090,
    bbox: { west: 77.10, south: 28.50, east: 77.30, north: 28.70 },
    metadata: {
      crs: 'EPSG:4326',
      modality: 'SAR',
      polarization: 'Hybrid Polarimetric (RH/RV)',
      format: 'GeoTIFF',
      speckle_filtered: true,
      processing_level: 'Level-1C Ground Range Detected (GRD)',
      co_registered_pair_id: 'img-cartosat-optical',
    },
    created_at: new Date('2026-01-11').toISOString(),
  },
  {
    id: 'img-sentinel1-sar',
    project_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    user_id: initialUser.user_id,
    file_name: 'S1A_IW_GRDH_1SDV_20251115_DELHI_NCR.tif',
    file_url: 'https://images.unsplash.com/photo-1524813686514-a57563d77d66?auto=format&fit=crop&w=1600&q=80',
    storage_path: 'satellite-images/sentinel1_delhi_sar.tif',
    source: 'Copernicus Open Access Hub',
    satellite: 'Sentinel-1A',
    sensor: 'C-SAR (C-Band Synthetic Aperture Radar)',
    acquisition_date: '2025-11-15',
    cloud_percentage: 0.0,
    resolution_meters: 10.0,
    bands: ['VV (Vertical Transmit - Vertical Receive)', 'VH (Vertical Transmit - Horizontal Receive)'],
    latitude: 28.6139,
    longitude: 77.2090,
    bbox: { west: 76.85, south: 28.40, east: 77.35, north: 28.85 },
    metadata: {
      crs: 'EPSG:4326',
      modality: 'SAR',
      polarization: 'Dual-Pol VV+VH',
      format: 'GeoTIFF',
      processing_level: 'Level-1 GRD High-Resolution',
      co_registered_pair_id: 'img-delhi-2025',
    },
    created_at: new Date('2025-11-16').toISOString(),
  },
];

const initialAlerts: Alert[] = [
  {
    id: 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
    user_id: initialUser.user_id,
    project_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    title: 'Urban Expansion Detected (+8.7%)',
    message: 'NDBI spectral anomaly indicated +8.7% new built-up area and road infrastructure along Dwarka Expressway corridor.',
    alert_type: 'URBAN_EXPANSION',
    severity: 'medium',
    is_read: false,
    created_at: new Date('2026-02-18T14:20:00Z').toISOString(),
  },
  {
    id: '06eebc99-9c0b-4ef8-bb6d-6bb9bd380a77',
    user_id: initialUser.user_id,
    project_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    title: 'Vegetation Canopy Loss (-5.2%)',
    message: 'NDVI calculation identified localized deforestation and tree canopy reduction in the southern ridge buffer zone.',
    alert_type: 'VEGETATION_DECREASE',
    severity: 'high',
    is_read: false,
    created_at: new Date('2026-02-24T09:15:00Z').toISOString(),
  },
  {
    id: '17eebc99-9c0b-4ef8-bb6d-6bb9bd380a88',
    user_id: initialUser.user_id,
    project_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    title: 'Glacial Lake Surface Expansion (+14.3%)',
    message: 'NDWI index confirmed expanding moraine lake perimeter following early thaw cycle.',
    alert_type: 'WATER_ANOMALY',
    severity: 'critical',
    is_read: false,
    created_at: new Date('2026-03-01T06:45:00Z').toISOString(),
  },
];

const initialSavedQueries: SavedQuery[] = [
  {
    id: 'sq-1',
    user_id: initialUser.user_id,
    project_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    query: 'How much vegetation is present?',
    category: 'Spectral Vegetation',
    created_at: new Date('2026-02-01').toISOString(),
  },
  {
    id: 'sq-2',
    user_id: initialUser.user_id,
    project_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    query: 'Identify buildings, roads and urban expansion in this area',
    category: 'Built-up Index',
    created_at: new Date('2026-02-05').toISOString(),
  },
  {
    id: 'sq-3',
    user_id: initialUser.user_id,
    project_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    query: 'Find water bodies and estimate reservoir surface area',
    category: 'Water Detection',
    created_at: new Date('2026-02-10').toISOString(),
  },
  {
    id: 'sq-4',
    user_id: initialUser.user_id,
    project_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    query: 'What changed between these two images?',
    category: 'Bi-Temporal Change',
    created_at: new Date('2026-02-12').toISOString(),
  },
];

// In-Memory Repository
class InMemoryStore {
  public users: Map<string, UserProfile> = new Map([[initialUser.user_id, initialUser]]);
  // Start with empty collections: no inbuilt demo data
  public projects: Map<string, Project> = new Map();
  public images: Map<string, SatelliteImage> = new Map();
  public sessions: Map<string, AnalysisSession> = new Map();
  public alerts: Map<string, Alert> = new Map();
  public savedQueries: Map<string, SavedQuery> = new Map();

  public clearAll(): void {
    this.projects.clear();
    this.images.clear();
    this.sessions.clear();
    this.alerts.clear();
    this.savedQueries.clear();
  }
}

export const inMemoryStore = new InMemoryStore();
