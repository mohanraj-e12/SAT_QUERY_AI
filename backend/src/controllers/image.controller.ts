import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { imageService } from '../services/image.service.js';
import { satelliteValidatorService } from '../geospatial/satellite-validator.service.js';

export class ImageController {
  public static async getImages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const projectId = req.query.projectId as string | undefined;
      const images = await imageService.getImages(userId, projectId);
      res.json({
        success: true,
        data: images,
        message: 'Satellite images retrieved successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'IMAGES_FETCH_FAILED', message: err.message },
      });
    }
  }

  public static async getImageById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const image = await imageService.getImageById(req.params.id);
      if (!image) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Satellite image not found' },
        });
        return;
      }
      res.json({
        success: true,
        data: image,
        message: 'Satellite image retrieved successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'IMAGE_FETCH_FAILED', message: err.message },
      });
    }
  }

  public static async uploadImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const { fileName, fileData, mimetype, projectId, source } = req.body;

      if (!fileName || !fileData) {
        res.status(400).json({
          success: false,
          error: 'fileName and fileData (base64) are required.',
          errorDetails: { code: 'VALIDATION_ERROR', message: 'fileName and fileData (base64) are required.' },
        });
        return;
      }

      // Check file extension
      const validExts = ['.jpg', '.jpeg', '.png', '.tif', '.tiff'];
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
      if (!validExts.includes(ext)) {
        res.status(400).json({
          success: false,
          error: `Unsupported format '${ext}'. Allowed: .jpg, .jpeg, .png, .tif, .tiff`,
          errorDetails: {
            code: 'INVALID_FORMAT',
            message: `Unsupported format '${ext}'. Allowed: .jpg, .jpeg, .png, .tif, .tiff`,
          },
        });
        return;
      }

      const cleanBase64 = String(fileData).replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      // Strictly validate whether uploaded file is authentic Earth observation / satellite imagery.
      // Gemini is configured to accept satellite, aerial, drone, SAR, and Google-Earth screenshots,
      // so only hard heuristic rejections (selfie/portrait/meme/etc) block here. Borderline scenes
      // proceed to the AI check inside the validator instead of failing the upload outright.
      let validation: { isValidSatellite: boolean; detectedType?: string; reason?: string; suggestedAction?: string };
      try {
        validation = await satelliteValidatorService.validateSatelliteImage(buffer, fileName, mimetype);
      } catch (validationErr: any) {
        console.warn('[ImageController] Satellite validation unavailable, allowing upload:', validationErr?.message || validationErr);
        validation = { isValidSatellite: true, detectedType: 'Satellite / Aerial Scene' };
      }
      if (!validation.isValidSatellite) {
        const errorMsg = `Invalid Image: The uploaded file does not appear to be a valid satellite, aerial, or Earth observation scene (${validation.detectedType}). Please submit a valid satellite image.`;
        res.status(400).json({
          success: false,
          error: errorMsg,
          errorDetails: {
            code: 'INVALID_SATELLITE_IMAGE',
            message: errorMsg,
            detectedType: validation.detectedType,
            reason: validation.reason,
            suggestedAction: validation.suggestedAction,
          },
        });
        return;
      }

      const image = await imageService.uploadImage({
        userId,
        projectId,
        fileName,
        buffer,
        mimetype: mimetype || 'image/jpeg',
        source: source || 'User Upload',
      });

      res.status(201).json({
        success: true,
        data: image,
        message: 'Satellite image uploaded and cataloged successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Image upload failed on server',
        errorDetails: { code: 'UPLOAD_FAILED', message: err.message },
      });
    }
  }

  public static async deleteImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const success = await imageService.deleteImage(req.params.id, userId);
      res.json({
        success,
        message: 'Satellite image deleted successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to delete satellite image',
        errorDetails: { code: 'DELETE_FAILED', message: err.message },
      });
    }
  }
}
