import { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../database/supabase.client.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const supabase = getSupabaseClient();

    if (supabase && token && token !== 'demo_analyst_token') {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          req.user = {
            id: user.id,
            email: user.email || 'user@satquery.ai',
            role: user.role,
          };
          return next();
        }
      } catch (err) {
        // Fallthrough to default analyst
      }
    }
  }

  // Default authenticated scientist session so features work immediately
  req.user = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'researcher@isro-geointel.org',
    role: 'lead_scientist',
  };
  next();
}
