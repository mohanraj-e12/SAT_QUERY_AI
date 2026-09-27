import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { projectService } from '../services/project.service.js';

export class ProjectController {
  public static async getProjects(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const projects = await projectService.getProjects(userId);
      res.json({
        success: true,
        data: projects,
        message: 'Projects retrieved successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'PROJECTS_FETCH_FAILED', message: err.message },
      });
    }
  }

  public static async getProjectById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const project = await projectService.getProjectById(req.params.id, userId);
      if (!project) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
        return;
      }
      res.json({
        success: true,
        data: project,
        message: 'Project retrieved successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'PROJECT_FETCH_FAILED', message: err.message },
      });
    }
  }

  public static async createProject(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const { name, description, aoi, tags } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Project name is required.' },
        });
        return;
      }

      const project = await projectService.createProject(userId, { name, description, aoi, tags });
      res.status(201).json({
        success: true,
        data: project,
        message: 'Project created successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'PROJECT_CREATE_FAILED', message: err.message },
      });
    }
  }

  public static async updateProject(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const updated = await projectService.updateProject(req.params.id, userId, req.body);
      if (!updated) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
        return;
      }
      res.json({
        success: true,
        data: updated,
        message: 'Project updated successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'PROJECT_UPDATE_FAILED', message: err.message },
      });
    }
  }

  public static async deleteProject(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const success = await projectService.deleteProject(req.params.id, userId);
      res.json({
        success,
        message: 'Project deleted successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'PROJECT_DELETE_FAILED', message: err.message },
      });
    }
  }
}
