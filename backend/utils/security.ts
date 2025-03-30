import { app } from 'electron';
import { SecurityConfig } from '../config/security';
import crypto from 'crypto';

export class SecurityUtils {
  /**
   * Generate a cryptographically secure random string
   */
  static generateSecureString(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Validate a password against security requirements
   */
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const { validation } = SecurityConfig;

    if (password.length < validation.password.minLength) {
      errors.push(`Password must be at least ${validation.password.minLength} characters long`);
    }
    if (validation.password.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (validation.password.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (validation.password.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (validation.password.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate an API key format
   */
  static validateApiKey(apiKey: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const { validation } = SecurityConfig;

    if (apiKey.length < validation.apiKey.minLength) {
      errors.push(`API key must be at least ${validation.apiKey.minLength} characters long`);
    }
    if (apiKey.length > validation.apiKey.maxLength) {
      errors.push(`API key must not exceed ${validation.apiKey.maxLength} characters`);
    }
    if (!validation.apiKey.pattern.test(apiKey)) {
      errors.push('API key contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitize file path to prevent directory traversal
   */
  static sanitizeFilePath(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const appPath = app.getPath('userData');
    
    // Ensure the path is within the app's user data directory
    if (!normalizedPath.startsWith(appPath)) {
      throw new Error('Invalid file path');
    }

    return normalizedPath;
  }

  /**
   * Validate file extension
   */
  static validateFileExtension(fileName: string): boolean {
    const { allowedExtensions } = SecurityConfig.fileSystem;
    const extension = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
    return allowedExtensions.includes(extension);
  }

  /**
   * Generate a secure state for OAuth
   */
  static generateOAuthState(): string {
    return this.generateSecureString(SecurityConfig.oauth.stateLength);
  }

  /**
   * Generate a code verifier for PKCE
   */
  static generateCodeVerifier(): string {
    return this.generateSecureString(SecurityConfig.oauth.codeVerifierLength);
  }

  /**
   * Generate a code challenge for PKCE
   */
  static async generateCodeChallenge(verifier: string): Promise<string> {
    const hash = crypto.createHash('sha256').update(verifier).digest('base64');
    return hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Validate Content Security Policy headers
   */
  static validateCSPHeaders(headers: Record<string, string>): boolean {
    const requiredDirectives = Object.keys(SecurityConfig.csp.directives);
    const headerKeys = Object.keys(headers).map(key => key.toLowerCase());
    
    return requiredDirectives.every(directive => 
      headerKeys.includes(directive.toLowerCase())
    );
  }

  /**
   * Check if a URL is allowed based on CSP rules
   */
  static isUrlAllowed(url: string, directive: keyof typeof SecurityConfig.csp.directives): boolean {
    const allowedSources = SecurityConfig.csp.directives[directive];
    return allowedSources.some(source => {
      if (source === "'self'") {
        return url.startsWith('http://localhost:') || url.startsWith('file://');
      }
      if (source === 'https:') {
        return url.startsWith('https://');
      }
      if (source === 'data:') {
        return url.startsWith('data:');
      }
      return url.startsWith(source);
    });
  }
} 