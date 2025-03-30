import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { SecurityConfig } from '../config/security';
import { SecurityUtils } from '../utils/security';

export const securityMiddleware = {
  /**
   * Apply all security middleware
   */
  apply(app: express.Application): void {
    // Basic security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: SecurityConfig.csp.directives,
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: 'same-site' },
      dnsPrefetchControl: true,
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: true,
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: SecurityConfig.rateLimit.windowMs,
      max: SecurityConfig.rateLimit.max,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use(limiter);

    // Request validation
    app.use(this.validateRequest);

    // Response security headers
    app.use(this.addSecurityHeaders);
  },

  /**
   * Validate incoming requests
   */
  validateRequest(req: express.Request, res: express.Response, next: express.NextFunction): void {
    // Validate Content-Type
    if (req.method === 'POST' || req.method === 'PUT') {
      const contentType = req.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        res.status(415).json({ error: 'Unsupported Media Type' });
        return;
      }
    }

    // Validate request body size
    const contentLength = parseInt(req.get('content-length') || '0', 10);
    if (contentLength > SecurityConfig.fileSystem.maxFileSize) {
      res.status(413).json({ error: 'Payload Too Large' });
      return;
    }

    // Validate file extensions in multipart requests
    if (req.is('multipart/form-data')) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (files) {
        for (const field in files) {
          const file = files[field][0];
          if (!SecurityUtils.validateFileExtension(file.originalname)) {
            res.status(400).json({ error: 'Invalid file type' });
            return;
          }
        }
      }
    }

    next();
  },

  /**
   * Add security headers to responses
   */
  addSecurityHeaders(req: express.Request, res: express.Response, next: express.NextFunction): void {
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Add cache control headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    next();
  },

  /**
   * Error handling middleware
   */
  errorHandler(err: Error, req: express.Request, res: express.Response, next: express.NextFunction): void {
    console.error(err.stack);

    // Don't leak error details in production
    const errorResponse = {
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : err.message,
    };

    res.status(500).json(errorResponse);
  },
}; 