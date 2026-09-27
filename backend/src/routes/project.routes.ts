import { Router } from 'express';
import { ProjectController } from '../controllers/project.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, ProjectController.getProjects);
router.post('/', authMiddleware, ProjectController.createProject);
router.get('/:id', authMiddleware, ProjectController.getProjectById);
router.put('/:id', authMiddleware, ProjectController.updateProject);
router.delete('/:id', authMiddleware, ProjectController.deleteProject);

export default router;
