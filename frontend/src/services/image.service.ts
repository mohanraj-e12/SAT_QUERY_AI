import { api } from './api.js';
import { SatelliteImage } from '../types/index.js';

const LOCAL_STORAGE_KEY = 'satquery_client_uploaded_images';

function getStoredLocalImages(): SatelliteImage[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredLocalImage(image: SatelliteImage) {
  try {
    const list = getStoredLocalImages().filter((img) => img.id !== image.id);
    list.unshift(image);
    // Retain up to 25 cataloged scenes in client storage
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 25)));
  } catch (e) {
    console.warn('[ImageService] Failed to cache image in localStorage:', e);
  }
}

function deriveClientMetadata(fileSize: number) {
  return {
    satellite: 'User-provided imagery',
    sensor: undefined,
    acquisition_date: null,
    cloud_percentage: null,
    resolution_meters: null,
    bands: [],
    latitude: null,
    longitude: null,
    bbox: null,
    metadata: { file_size_bytes: fileSize },
  };
}

export const imageService = {
  getImages: async (projectId?: string): Promise<SatelliteImage[]> => {
    const local = getStoredLocalImages();
    try {
      const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      const serverImages = await api.get<SatelliteImage[]>(`/api/images${query}`);
      const serverIds = new Set(serverImages.map((i) => i.id));
      const filteredLocal = local.filter((l) => !serverIds.has(l.id) && (!projectId || l.project_id === projectId));
      return [...filteredLocal, ...serverImages];
    } catch (err) {
      console.warn('[ImageService] Server catalog unavailable, using local cache:', err);
      return projectId ? local.filter((l) => l.project_id === projectId) : local;
    }
  },

  getImageById: async (id: string): Promise<SatelliteImage> => {
    const local = getStoredLocalImages().find((img) => img.id === id);
    if (local) return local;
    return api.get<SatelliteImage>(`/api/images/${id}`);
  },

  uploadImage: async (payload: {
    fileName: string;
    fileData: string; // base64
    mimetype: string;
    projectId?: string | null;
    source?: string;
  }): Promise<SatelliteImage> => {
    try {
      const serverImage = await api.post<SatelliteImage>('/api/images/upload', payload);
      saveStoredLocalImage(serverImage);
      return serverImage;
    } catch (err: any) {
      // If server explicitly returned validation refusal for non-satellite images, rethrow
      if (err.code === 'INVALID_SATELLITE_IMAGE' || err.message?.includes('Invalid Image')) {
        throw err;
      }

      console.warn('[ImageService] Backend upload unavailable, activating resilient local ingestion:', err.message);

      const approxBytes = Math.round((payload.fileData.length * 3) / 4);
      const meta = deriveClientMetadata(approxBytes);
      const localId = `img-client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const localImage: SatelliteImage = {
        id: localId,
        project_id: payload.projectId || null,
        user_id: 'client-analyst',
        file_name: payload.fileName,
        file_url: payload.fileData,
        storage_path: `client-local/${payload.fileName}`,
        source: payload.source || 'Local Satellite Ingestion',
        satellite: meta.satellite,
        sensor: meta.sensor,
        acquisition_date: meta.acquisition_date,
        cloud_percentage: meta.cloud_percentage,
        resolution_meters: meta.resolution_meters,
        bands: meta.bands,
        latitude: meta.latitude,
        longitude: meta.longitude,
        bbox: meta.bbox,
        metadata: meta.metadata,
        created_at: new Date().toISOString(),
      };

      saveStoredLocalImage(localImage);
      return localImage;
    }
  },

  deleteImage: async (id: string): Promise<boolean> => {
    try {
      const current = getStoredLocalImages();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current.filter((img) => img.id !== id)));
    } catch {}

    try {
      return await api.delete<boolean>(`/api/images/${id}`);
    } catch {
      return true;
    }
  },
};
