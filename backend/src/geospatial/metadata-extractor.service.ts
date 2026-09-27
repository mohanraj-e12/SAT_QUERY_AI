import { SatelliteMetadata } from '../models/types.js';

export interface ExtractedImageInfo {
  satellite: string;
  sensor: string | null;
  acquisitionDate: string | null;
  cloudPercentage: number | null;
  resolutionMeters: number | null;
  bands: string[];
  latitude: number | null;
  longitude: number | null;
  bbox: { west: number; south: number; east: number; north: number } | null;
  metadata: SatelliteMetadata;
}

export class MetadataExtractorService {
  /** Return only verifiable evidence; if absent mark fields unavailable rather than guessing. */
  public extractMetadata(fileName: string, fileSize: number): ExtractedImageInfo {
    const lower = fileName.toLowerCase();
    const isGeoTiff = lower.endsWith('.tif') || lower.endsWith('.tiff');
    return {
      satellite: 'User-provided imagery',
      sensor: null,
      acquisitionDate: this.extractDateFromFilename(fileName),
      cloudPercentage: null,
      resolutionMeters: null,
      bands: [],
      latitude: null,
      longitude: null,
      bbox: null,
      metadata: {
        file_size_bytes: fileSize,
        format: isGeoTiff ? 'GeoTIFF' : lower.split('.').pop()?.toUpperCase() || 'Unknown',
        georeferenced: false,
        crs: 'EPSG:4326 (image-relative, unreferenced)',
      },
    };
  }

  private extractDateFromFilename(fileName: string): string | null {
    const match = fileName.match(/(\d{4})(\d{2})(\d{2})/);
    if (match) {
      const year = match[1];
      const month = match[2];
      const day = match[3];
      if (parseInt(year) >= 2000 && parseInt(month) >= 1 && parseInt(month) <= 12 && parseInt(day) >= 1 && parseInt(day) <= 31) {
        return `${year}-${month}-${day}`;
      }
    }
    return null;
  }
}

export const metadataExtractorService = new MetadataExtractorService();
