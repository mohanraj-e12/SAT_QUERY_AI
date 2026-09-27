import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { alertService } from '../services/alert.service.js';

export class AlertController {
  public static async getAlerts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const alerts = await alertService.getAlerts(userId);
      res.json({
        success: true,
        data: alerts,
        message: 'Alerts retrieved successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'ALERTS_FETCH_FAILED', message: err.message },
      });
    }
  }

  public static async markRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const isRead = req.body.is_read !== undefined ? req.body.is_read : true;
      const updated = await alertService.markAsRead(id, isRead);
      if (!updated) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Alert not found' },
        });
        return;
      }
      res.json({
        success: true,
        data: updated,
        message: `Alert marked as ${isRead ? 'read' : 'unread'}`,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'ALERT_UPDATE_FAILED', message: err.message },
      });
    }
  }

  public static async deleteAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const success = await alertService.deleteAlert(req.params.id);
      res.json({
        success,
        message: 'Alert dismissed successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'ALERT_DELETE_FAILED', message: err.message },
      });
    }
  }
}
