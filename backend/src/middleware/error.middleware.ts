import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[SatQuery API Error]:', err);

  const statusCode = err.status || err.statusCode || 500;
  const errorCode = err.code || (err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_SERVER_ERROR');
  const errorMessage = err.type === 'entity.too.large'
    ? 'File payload exceeds maximum allowed size (50MB). Please choose a smaller tile or compressed image.'
    : (err.message || 'An unexpected error occurred during remote sensing analysis.');

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    errorDetails: {
      code: errorCode,
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
    message: errorMessage,
  });
}
