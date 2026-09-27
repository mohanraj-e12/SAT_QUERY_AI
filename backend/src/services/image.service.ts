import { SatelliteImage } from '../models/types.js';
import { inMemoryStore } from '../database/store.js';
import { getSupabaseAdminClient } from '../database/supabase.client.js';
import { metadataExtractorService } from '../geospatial/metadata-extractor.service.js';

export class ImageService {
  public async getImages(userId: string, projectId?: string): Promise<SatelliteImage[]> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        let query = supabase.from('satellite_images').select('*').order('created_at', { ascending: false });
        if (projectId) {
          query = query.eq('project_id', projectId);
        }
        const { data, error } = await query;
        if (!error && data) {
          return data as SatelliteImage[];
        }
      } catch (err) {
        console.warn('[ImageService] Supabase select failed:', err);
      }
    }

    const all = Array.from(inMemoryStore.images.values());
    if (projectId) {
      return all.filter((i) => i.project_id === projectId);
    }
    return all;
  }

  public async getImageById(id: string): Promise<SatelliteImage | null> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('satellite_images')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return data as SatelliteImage;
        }
      } catch (err) {
        console.warn('[ImageService] Supabase get by id failed:', err);
      }
    }

    return inMemoryStore.images.get(id) || null;
  }

  public async uploadImage(params: {
    userId: string;
    projectId?: string | null;
    fileName: string;
    buffer: Buffer;
    mimetype: string;
    source?: string;
  }): Promise<SatelliteImage> {
    const { userId, projectId, fileName, buffer, mimetype, source } = params;
    const extracted = metadataExtractorService.extractMetadata(fileName, buffer.length);
    const imageId = crypto.randomUUID();
    const storagePath = `satellite-images/${userId}/${imageId}_${fileName}`;

    let fileUrl = '';
    const supabase = getSupabaseAdminClient();

    if (supabase) {
      try {
        const { data: uploadRes, error: uploadErr } = await supabase.storage
          .from('satellite-images')
          .upload(storagePath, buffer, {
            contentType: mimetype,
            upsert: true,
          });

        if (!uploadErr && uploadRes) {
          const { data: urlData } = supabase.storage
            .from('satellite-images')
            .getPublicUrl(storagePath);
          fileUrl = urlData.publicUrl;
        }
      } catch (err) {
        console.warn('[ImageService] Supabase storage upload failed:', err);
      }
    }

    if (!fileUrl) {
      // Fallback base64 or object data URI for offline/demo reliability
      fileUrl = `data:${mimetype};base64,${buffer.toString('base64')}`;
    }

    const newImage: SatelliteImage = {
      id: imageId,
      project_id: projectId || null,
      user_id: userId,
      file_name: fileName,
      file_url: fileUrl,
      storage_path: storagePath,
      source: source || 'User Upload',
      satellite: extracted.satellite ?? 'Unknown',
      sensor: extracted.sensor ?? undefined,
      acquisition_date: extracted.acquisitionDate,
      cloud_percentage: extracted.cloudPercentage,
      resolution_meters: extracted.resolutionMeters,
      bands: extracted.bands,
      latitude: extracted.latitude,
      longitude: extracted.longitude,
      bbox: extracted.bbox,
      metadata: extracted.metadata,
      created_at: new Date().toISOString(),
    };

    if (supabase) {
      try {
        await supabase.from('satellite_images').insert(newImage);
      } catch (err) {
        console.warn('[ImageService] Supabase db insert failed:', err);
      }
    }

    inMemoryStore.images.set(newImage.id, newImage);
    return newImage;
  }

  public async deleteImage(id: string, userId: string): Promise<boolean> {
    const img = inMemoryStore.images.get(id);
    if (!img) return false;

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        await supabase.storage.from('satellite-images').remove([img.storage_path]);
        await supabase.from('satellite_images').delete().eq('id', id);
      } catch (err) {
        console.warn('[ImageService] Supabase delete failed:', err);
      }
    }

    return inMemoryStore.images.delete(id);
  }
}

export const imageService = new ImageService();
