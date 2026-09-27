import { Request, Response } from 'express';
import { satelliteValidatorService } from '../geospatial/satellite-validator.service.js';

export class SatelliteController {
  /**
   * Status check for satellite verification service
   */
  public static async getStatus(req: Request, res: Response): Promise<void> {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      success: true,
      service: 'Satellite Authenticity Verification Service',
      status: 'operational',
      supportedFormats: ['.jpg', '.jpeg', '.png', '.tif', '.tiff'],
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Validates whether an uploaded image is authentic satellite, aerial, or Earth observation imagery.
   * Endpoints: POST /api/satellite/authenticity and POST /api/satellite/validate
   */
  public static async validateAuthenticity(req: Request, res: Response): Promise<void> {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    try {
      const { fileData, imageBase64, image, fileName, name, mimetype, mimeType } = req.body || {};
      const rawData = fileData || imageBase64 || image;
      const targetFileName = fileName || name || 'satellite_scene.jpg';
      const targetMime = mimetype || mimeType || 'image/jpeg';

      if (!rawData) {
        res.status(400).json({
          success: false,
          authentic: false,
          error: 'Image fileData (base64 string) is required for satellite authenticity verification.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const cleanBase64 = String(rawData).replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      if (buffer.length === 0) {
        res.status(400).json({
          success: false,
          authentic: false,
          error: 'Uploaded image file buffer is empty.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      // Perform multimodal + heuristic Earth observation verification
      const validation = await satelliteValidatorService.validateSatelliteImage(
        buffer,
        targetFileName,
        targetMime
      );

      if (!validation.isValidSatellite) {
        res.status(200).json({
          success: false,
          authentic: false,
          error: `Satellite validation failed: The uploaded file does not appear to be a valid satellite scene (${validation.detectedType}).`,
          code: 'VALIDATION_ERROR',
          detectedType: validation.detectedType,
          confidence: validation.confidence,
          reason: validation.reason,
          suggestedAction: validation.suggestedAction,
          data: {
            authentic: false,
            isValidSatellite: false,
            detectedType: validation.detectedType,
            confidence: validation.confidence,
            reason: validation.reason,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        authentic: true,
        message: 'Satellite data validated successfully',
        detectedType: validation.detectedType,
        confidence: validation.confidence,
        data: {
          authentic: true,
          isValidSatellite: true,
          detectedType: validation.detectedType,
          confidence: validation.confidence,
          reason: validation.reason,
          suggestedAction: validation.suggestedAction,
        },
      });
    } catch (err: any) {
      console.error('[SatelliteController] Error during authenticity check:', err);
      res.status(500).json({
        success: false,
        authentic: false,
        error: 'Satellite validation service returned an internal error. Please try again or proceed with caution.',
        code: 'VALIDATION_UNAVAILABLE',
        details: err?.message,
      });
    }
  }
}
