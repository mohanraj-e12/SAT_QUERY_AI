import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { authService } from '../services/auth.service.js';
import { isSupabaseConnected } from '../database/supabase.client.js';

export class AuthController {
  public static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const profile = await authService.getProfile(userId);
      res.json({
        success: true,
        data: {
          profile,
          supabaseConnected: isSupabaseConnected(),
        },
        message: 'Profile retrieved successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'PROFILE_FETCH_FAILED', message: err.message },
      });
    }
  }

  public static async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const updated = await authService.updateProfile(userId, req.body);
      res.json({
        success: true,
        data: updated,
        message: 'Profile updated successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'PROFILE_UPDATE_FAILED', message: err.message },
      });
    }
  }
}
