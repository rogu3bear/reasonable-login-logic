import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { SecurityConfig } from '../config/security';

interface SecurityIssue {
  severity: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  recommendation: string;
  affectedFiles?: string[];
}

export class SecurityAudit {
  private issues: SecurityIssue[] = [];

  /**
   * Run a comprehensive security audit
   */
  async runAudit(): Promise<SecurityIssue[]> {
    this.issues = [];

    // Check file permissions
    await this.checkFilePermissions();

    // Check for sensitive data in files
    await this.checkForSensitiveData();

    // Check for outdated dependencies
    await this.checkDependencies();

    // Check for security misconfigurations
    await this.checkSecurityConfig();

    // Check for potential XSS vulnerabilities
    await this.checkXSSVulnerabilities();

    // Check for potential CSRF vulnerabilities
    await this.checkCSRFVulnerabilities();

    // Check for potential injection vulnerabilities
    await this.checkInjectionVulnerabilities();

    return this.issues;
  }

  /**
   * Check file permissions
   */
  private async checkFilePermissions(): Promise<void> {
    const userDataPath = app.getPath('userData');
    const files = await fs.promises.readdir(userDataPath);

    for (const file of files) {
      const filePath = path.join(userDataPath, file);
      const stats = await fs.promises.stat(filePath);

      // Check for world-readable files
      if (stats.mode & 0o004) {
        this.addIssue({
          severity: 'high',
          category: 'File Permissions',
          description: `File ${file} has world-readable permissions`,
          recommendation: 'Restrict file permissions to owner only',
          affectedFiles: [filePath],
        });
      }

      // Check for world-writable files
      if (stats.mode & 0o002) {
        this.addIssue({
          severity: 'high',
          category: 'File Permissions',
          description: `File ${file} has world-writable permissions`,
          recommendation: 'Restrict file permissions to owner only',
          affectedFiles: [filePath],
        });
      }
    }
  }

  /**
   * Check for sensitive data in files
   */
  private async checkForSensitiveData(): Promise<void> {
    const userDataPath = app.getPath('userData');
    const sensitivePatterns = [
      /api[_-]?key/i,
      /password/i,
      /secret/i,
      /token/i,
      /credential/i,
    ];

    await this.scanDirectory(userDataPath, sensitivePatterns);
  }

  /**
   * Recursively scan directory for sensitive data
   */
  private async scanDirectory(dir: string, patterns: RegExp[]): Promise<void> {
    const files = await fs.promises.readdir(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await fs.promises.stat(filePath);

      if (stats.isDirectory()) {
        await this.scanDirectory(filePath, patterns);
        continue;
      }

      if (file.endsWith('.json') || file.endsWith('.txt')) {
        const content = await fs.promises.readFile(filePath, 'utf8');
        
        for (const pattern of patterns) {
          if (pattern.test(content)) {
            this.addIssue({
              severity: 'high',
              category: 'Sensitive Data',
              description: `File ${file} contains potential sensitive data`,
              recommendation: 'Review and remove sensitive data or use encryption',
              affectedFiles: [filePath],
            });
          }
        }
      }
    }
  }

  /**
   * Check for outdated dependencies
   */
  private async checkDependencies(): Promise<void> {
    const packageJson = require('../../package.json');
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [name, version] of Object.entries(dependencies)) {
      // Check for known vulnerabilities
      if (this.hasKnownVulnerabilities(name, version as string)) {
        this.addIssue({
          severity: 'medium',
          category: 'Dependencies',
          description: `Package ${name} ${version} may have known vulnerabilities`,
          recommendation: 'Update to the latest secure version',
        });
      }
    }
  }

  /**
   * Check for security misconfigurations
   */
  private async checkSecurityConfig(): Promise<void> {
    // Check CSP configuration
    if (!this.validateCSPConfig()) {
      this.addIssue({
        severity: 'high',
        category: 'Security Configuration',
        description: 'Content Security Policy configuration is incomplete',
        recommendation: 'Review and update CSP directives',
      });
    }

    // Check rate limiting configuration
    if (!this.validateRateLimitConfig()) {
      this.addIssue({
        severity: 'medium',
        category: 'Security Configuration',
        description: 'Rate limiting configuration may be too permissive',
        recommendation: 'Review and adjust rate limiting settings',
      });
    }

    // Check session configuration
    if (!this.validateSessionConfig()) {
      this.addIssue({
        severity: 'medium',
        category: 'Security Configuration',
        description: 'Session configuration may be insecure',
        recommendation: 'Review and update session settings',
      });
    }
  }

  /**
   * Check for potential XSS vulnerabilities
   */
  private async checkXSSVulnerabilities(): Promise<void> {
    const frontendPath = path.join(__dirname, '../../frontend/src');
    const xssPatterns = [
      /innerHTML/i,
      /outerHTML/i,
      /insertAdjacentHTML/i,
      /document\.write/i,
    ];

    await this.scanDirectory(frontendPath, xssPatterns);
  }

  /**
   * Check for potential CSRF vulnerabilities
   */
  private async checkCSRFVulnerabilities(): Promise<void> {
    const backendPath = path.join(__dirname, '../');
    const csrfPatterns = [
      /app\.use\(csrf/i,
      /csrfProtection/i,
    ];

    await this.scanDirectory(backendPath, csrfPatterns);
  }

  /**
   * Check for potential injection vulnerabilities
   */
  private async checkInjectionVulnerabilities(): Promise<void> {
    const backendPath = path.join(__dirname, '../');
    const injectionPatterns = [
      /exec\(/i,
      /spawn\(/i,
      /eval\(/i,
      /new Function\(/i,
    ];

    await this.scanDirectory(backendPath, injectionPatterns);
  }

  /**
   * Add a security issue to the list
   */
  private addIssue(issue: SecurityIssue): void {
    this.issues.push(issue);
  }

  /**
   * Check if a package has known vulnerabilities
   */
  private hasKnownVulnerabilities(name: string, version: string): boolean {
    // This is a simplified check. In a real implementation, you would:
    // 1. Query a vulnerability database (e.g., npm audit, Snyk)
    // 2. Check version ranges against known vulnerable versions
    // 3. Consider the severity of vulnerabilities
    return false;
  }

  /**
   * Validate CSP configuration
   */
  private validateCSPConfig(): boolean {
    const { directives } = SecurityConfig.csp;
    const requiredDirectives = [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'connect-src',
    ];

    return requiredDirectives.every(directive => 
      directives[directive as keyof typeof directives]
    );
  }

  /**
   * Validate rate limiting configuration
   */
  private validateRateLimitConfig(): boolean {
    const { windowMs, max } = SecurityConfig.rateLimit;
    return windowMs > 0 && max > 0 && max <= 100;
  }

  /**
   * Validate session configuration
   */
  private validateSessionConfig(): boolean {
    const { timeout, maxSessions } = SecurityConfig.session;
    return timeout > 0 && maxSessions > 0 && maxSessions <= 10;
  }
} 