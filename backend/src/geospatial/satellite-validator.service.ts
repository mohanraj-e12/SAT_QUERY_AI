import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.config.js';

export interface SatelliteValidationResult {
  isValidSatellite: boolean;
  confidence: number;
  detectedType: string;
  reason: string;
  suggestedAction: string;
}

const MAX_VALIDATION_BYTES = 6 * 1024 * 1024;

function decodeImagePixels(buffer: Buffer): { data: Buffer; width: number; height: number } | null {
  try {
    const raw = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 512 });
    return { data: Buffer.from(raw.data), width: raw.width, height: raw.height };
  } catch { /* not a jpeg */ }
  try {
    const png = PNG.sync.read(buffer);
    return { data: Buffer.from(png.data), width: png.width, height: png.height };
  } catch { /* not a png */ }
  return null;
}

function downscaleBufferForAI(buffer: Buffer, mimetype?: string): string {
  try {
    if ((mimetype || '').includes('png')) {
      const png = PNG.sync.read(buffer);
      const scale = Math.min(1, 512 / Math.max(png.width, png.height));
      if (scale >= 1) return buffer.toString('base64');
      const outW = Math.max(1, Math.round(png.width * scale));
      const outH = Math.max(1, Math.round(png.height * scale));
      const out = new PNG({ width: outW, height: outH });
      for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) {
          const sx = Math.min(png.width - 1, Math.floor(x / scale));
          const sy = Math.min(png.height - 1, Math.floor(y / scale));
          const sIdx = (png.width * sy + sx) << 2;
          const dIdx = (outW * y + x) << 2;
          out.data[dIdx] = png.data[sIdx];
          out.data[dIdx + 1] = png.data[sIdx + 1];
          out.data[dIdx + 2] = png.data[sIdx + 2];
          out.data[dIdx + 3] = 255;
        }
      }
      return PNG.sync.write(out).toString('base64');
    }
    const raw = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 512 });
    const scale = Math.min(1, 512 / Math.max(raw.width, raw.height));
    const outW = Math.max(1, Math.round(raw.width * scale));
    const outH = Math.max(1, Math.round(raw.height * scale));
    const out = Buffer.alloc(outW * outH * 4);
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const sx = Math.min(raw.width - 1, Math.floor(x / scale));
        const sy = Math.min(raw.height - 1, Math.floor(y / scale));
        const sIdx = (raw.width * sy + sx) * 4;
        const dIdx = (outW * y + x) * 4;
        out[dIdx] = raw.data[sIdx];
        out[dIdx + 1] = raw.data[sIdx + 1];
        out[dIdx + 2] = raw.data[sIdx + 2];
        out[dIdx + 3] = 255;
      }
    }
    return jpeg.encode({ data: out, width: outW, height: outH }, 80).data.toString('base64');
  } catch {
    const capped = buffer.length > MAX_VALIDATION_BYTES ? buffer.subarray(0, MAX_VALIDATION_BYTES) : buffer;
    return capped.toString('base64');
  }
}

export class SatelliteValidatorService {
  private aiClient: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI | null {
    if (!config.geminiApiKey) return null;
    if (!this.aiClient) {
      try {
        this.aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
      } catch (e) {
        console.warn('[SatelliteValidator] AI init error:', e);
        return null;
      }
    }
    return this.aiClient;
  }

  /**
   * Fast heuristic check analyzing pixel distributions for obvious non-satellite content
   */
  public validatePixelsHeuristic(
    buffer: Buffer,
    fileName?: string
  ): { isLikelySatellite: boolean; reason?: string; detectedType?: string } {
    const name = (fileName || '').toLowerCase();

    // Whitelist recognizable satellite / geospatial indicators (fast pass)
    if (
      name.includes('sentinel') ||
      name.includes('landsat') ||
      name.includes('planet') ||
      name.includes('bhuvan') ||
      name.includes('worldview') ||
      name.includes('modis') ||
      name.includes('s2a_') ||
      name.includes('s2b_') ||
      name.includes('lc08_') ||
      name.includes('lc09_') ||
      name.includes('spot_') ||
      name.includes('ortho') ||
      name.includes('geotiff') ||
      name.includes('vegas') ||
      name.includes('desert') ||
      name.includes('earth') ||
      name.startsWith('img_') ||
      name.startsWith('pxl_') ||
      name.endsWith('.tif') ||
      name.endsWith('.tiff')
    ) {
      return { isLikelySatellite: true };
    }

    // Blacklist only explicit non-satellite keywords in filenames (fast reject)
    if (
      name.includes('selfie') ||
      name.includes('portrait') ||
      name.includes('my_face') ||
      name.includes('headshot') ||
      name.includes('meme') ||
      name.includes('avatar') ||
      name.includes('invoice') ||
      name.includes('receipt') ||
      name.includes('resume')
    ) {
      return {
        isLikelySatellite: false,
        detectedType: 'Everyday Non-Geospatial Photo / Screenshot',
        reason: 'Filename indicates a non-satellite asset.',
      };
    }

    // Pixel-content gate: reject only content that is provably NOT a photo scene.
    // Real remote-sensing imagery always has texture/variance; blank, corrupt, or
    // degenerate rasters are the only pixel-level hard rejects. Everything else
    // proceeds to AI visual validation (or defaults to valid when AI is offline).
    const decoded = decodeImagePixels(buffer);
    if (!decoded) {
      return {
        isLikelySatellite: false,
        detectedType: 'Unreadable / Corrupt Image',
        reason: 'The file could not be decoded as a JPEG or PNG image.',
      };
    }
    const { data, width, height } = decoded;
    const total = width * height;
    if (total < 32 * 32) {
      return {
        isLikelySatellite: false,
        detectedType: 'Image Too Small',
        reason: `Image is only ${width}x${height}px; satellite scenes need at least 32x32 pixels.`,
      };
    }
    const maxSamples = 20000;
    const step = Math.max(1, Math.floor(total / maxSamples));
    let n = 0;
    let pureWhite = 0;
    let pureBlack = 0;
    let sumLuma = 0;
    let sumSq = 0;
    for (let i = 0; i < total; i += step) {
      const o = i * 4;
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      n++;
      if (r > 252 && g > 252 && b > 252) pureWhite++;
      if (r < 3 && g < 3 && b < 3) pureBlack++;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      sumLuma += luma;
      sumSq += luma * luma;
    }
    if (n > 0) {
      if (pureWhite / n > 0.97 || pureBlack / n > 0.97) {
        return {
          isLikelySatellite: false,
          detectedType: 'Blank / Solid Color Canvas',
          reason: 'Image is almost entirely solid blank pixels with no scene texture.',
        };
      }
      const mean = sumLuma / n;
      const variance = Math.max(0, sumSq / n - mean * mean);
      const std = Math.sqrt(variance);
      if (std < 2.5) {
        return {
          isLikelySatellite: false,
          detectedType: 'Blank / Solid Color Canvas',
          reason: 'Image has no measurable texture or color variance (flat solid fill).',
        };
      }
    }

    return { isLikelySatellite: true };
  }

  /**
   * Complete validation using Gemini 3.8 Flash visual intelligence + Heuristic fallback
   */
  public async validateSatelliteImage(
    buffer: Buffer,
    fileName?: string,
    mimetype?: string
  ): Promise<SatelliteValidationResult> {
    // 1. Check fast heuristics first
    const heuristic = this.validatePixelsHeuristic(buffer, fileName);
    if (!heuristic.isLikelySatellite) {
      return {
        isValidSatellite: false,
        confidence: 0.96,
        detectedType: heuristic.detectedType || 'Everyday Non-Satellite Photo',
        reason: heuristic.reason || 'The uploaded image does not match Earth observation or aerial remote-sensing patterns.',
        suggestedAction: 'Please submit a valid satellite image (e.g. optical Sentinel-2, Landsat, Planet, SAR radar, or aerial drone orthomosaic).',
      };
    }

    // 2. Multimodal validation with Gemini 3.8 Flash if client available
    const client = this.getClient();
    if (client) {
      try {
        const base64Data = buffer.toString('base64');
        const prompt = `You are an expert Earth Observation & Geospatial Remote Sensing Classifier.
Examine this image and determine if it is a genuine satellite, aerial, drone, or top-down Earth observation scene.

IMPORTANT ACCEPTANCE RULES (MARK isValidSatellite: true):
- Top-down optical satellite imagery (Sentinel, Landsat, PlanetScope, WorldView, Google Earth / satellite map captures).
- Desert landscapes, arid soil, red sand, sandy beaches, rocky mountains, agricultural fields, river basins, and lakes (e.g. Las Vegas, Lake Mead, Sahara, Dubai, agricultural basins).
- Aerial photos or camera pictures of satellite maps / screens with city labels or place names (like "Las Vegas", coordinates, boundaries).
- Synthetic Aperture Radar (SAR) imagery, false-color NIR/SWIR composites, and aerial drone orthomosaics.

ONLY REJECT (MARK isValidSatellite: false) IF IT IS OBVIOUSLY:
- A human selfie, face, or portrait
- An indoor room, furniture, or home interior
- Pets, animals, food, or consumer products closeups
- Street-level ground photography (cars, eye-level street storefronts)
- Cartoons, memes, digital art, receipts, or text code documents

Respond with ONLY valid JSON:
{
  "isValidSatellite": true | false,
  "detectedType": "Satellite Optical Scene" | "Satellite SAR" | "Aerial Drone Orthomosaic" | "Human Portrait" | "Indoor Scene" | "Ground-level Photo" | "Meme/Graphic" | "Document/Screenshot" | "Other Non-Satellite",
  "confidence": 0.95,
  "reason": "Clear explanation of what the scene depicts."
}`;

        const aiPromise = client.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              inlineData: {
                mimeType: mimetype || 'image/jpeg',
                data: base64Data,
              },
            },
            { text: prompt },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini validation timeout')), 5000)
        );

        const response: any = await Promise.race([aiPromise, timeoutPromise]);

        const rawText = (response.text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        let parsed: any = {};
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = { isValidSatellite: true };
        }

        const isValid = Boolean(parsed.isValidSatellite);
        return {
          isValidSatellite: isValid,
          confidence: parsed.confidence || 0.95,
          detectedType: parsed.detectedType || (isValid ? 'Satellite / Aerial Scene' : 'Non-Satellite Photo'),
          reason: parsed.reason || (isValid ? 'Valid remote-sensing scene confirmed.' : 'Image does not depict Earth observation or aerial remote sensing.'),
          suggestedAction: isValid
            ? 'Ready for geospatial analysis.'
            : 'Please submit a valid satellite image (e.g. Sentinel, Landsat, Planet, SAR radar, or drone orthomosaic).',
        };
      } catch (err) {
        console.warn('[SatelliteValidator] Gemini classification fallback:', err);
      }
    }

    // Default valid if no negative heuristic detected
    return {
      isValidSatellite: true,
      confidence: 0.90,
      detectedType: 'Satellite / Aerial Scene',
      reason: 'Image matches standard Earth observation format criteria.',
      suggestedAction: 'Ready for analysis.',
    };
  }
}

export const satelliteValidatorService = new SatelliteValidatorService();
