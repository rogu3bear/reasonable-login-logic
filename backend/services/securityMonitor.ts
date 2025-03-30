import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { SecurityConfig } from '../config/security';

interface SecurityEvent {
  timestamp: number;
  type: 'auth' | 'file' | 'network' | 'system' | 'error';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: Record<string, unknown>;
  ip?: string;
  userId?: string;
}

export class SecurityMonitor {
  private logFile: string;
  private maxLogSize: number = 10 * 1024 * 1024; // 10MB
  private maxLogFiles: number = 5;

  constructor() {
    const userDataPath = app.getPath('userData');
    const logsDir = path.join(userDataPath, 'logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logFile = path.join(logsDir, 'security.log');
  }

  /**
   * Log a security event
   */
  async logEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now(),
    };

    const logEntry = JSON.stringify(fullEvent) + '\n';

    try {
      // Check if log file needs rotation
      if (fs.existsSync(this.logFile)) {
        const stats = await fs.promises.stat(this.logFile);
        if (stats.size >= this.maxLogSize) {
          await this.rotateLogFile();
        }
      }

      // Append log entry
      await fs.promises.appendFile(this.logFile, logEntry);

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Security] ${event.type.toUpperCase()}: ${event.message}`);
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Rotate log file
   */
  private async rotateLogFile(): Promise<void> {
    const dir = path.dirname(this.logFile);
    const ext = path.extname(this.logFile);
    const base = path.basename(this.logFile, ext);

    // Remove oldest log file if we've reached max files
    const oldLogFile = path.join(dir, `${base}.${this.maxLogFiles}${ext}`);
    if (fs.existsSync(oldLogFile)) {
      await fs.promises.unlink(oldLogFile);
    }

    // Rotate existing log files
    for (let i = this.maxLogFiles - 1; i > 0; i--) {
      const oldFile = path.join(dir, `${base}.${i}${ext}`);
      const newFile = path.join(dir, `${base}.${i + 1}${ext}`);
      
      if (fs.existsSync(oldFile)) {
        await fs.promises.rename(oldFile, newFile);
      }
    }

    // Rename current log file
    const newLogFile = path.join(dir, `${base}.1${ext}`);
    await fs.promises.rename(this.logFile, newLogFile);
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(severity: SecurityEvent['severity'], message: string, details?: Record<string, unknown>): Promise<void> {
    await this.logEvent({
      type: 'auth',
      severity,
      message,
      details,
    });
  }

  /**
   * Log file system events
   */
  async logFileEvent(severity: SecurityEvent['severity'], message: string, details?: Record<string, unknown>): Promise<void> {
    await this.logEvent({
      type: 'file',
      severity,
      message,
      details,
    });
  }

  /**
   * Log network events
   */
  async logNetworkEvent(severity: SecurityEvent['severity'], message: string, ip?: string, details?: Record<string, unknown>): Promise<void> {
    await this.logEvent({
      type: 'network',
      severity,
      message,
      ip,
      details,
    });
  }

  /**
   * Log system events
   */
  async logSystemEvent(severity: SecurityEvent['severity'], message: string, details?: Record<string, unknown>): Promise<void> {
    await this.logEvent({
      type: 'system',
      severity,
      message,
      details,
    });
  }

  /**
   * Log error events
   */
  async logErrorEvent(message: string, details?: Record<string, unknown>): Promise<void> {
    await this.logEvent({
      type: 'error',
      severity: 'error',
      message,
      details,
    });
  }

  /**
   * Get recent security events
   */
  async getRecentEvents(limit: number = 100): Promise<SecurityEvent[]> {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const content = await fs.promises.readFile(this.logFile, 'utf8');
      const events = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      return events;
    } catch (error) {
      console.error('Failed to read security events:', error);
      return [];
    }
  }

  /**
   * Search security events
   */
  async searchEvents(query: {
    type?: SecurityEvent['type'];
    severity?: SecurityEvent['severity'];
    startTime?: number;
    endTime?: number;
    ip?: string;
    userId?: string;
  }): Promise<SecurityEvent[]> {
    try {
      const events = await this.getRecentEvents();
      return events.filter(event => {
        if (query.type && event.type !== query.type) return false;
        if (query.severity && event.severity !== query.severity) return false;
        if (query.startTime && event.timestamp < query.startTime) return false;
        if (query.endTime && event.timestamp > query.endTime) return false;
        if (query.ip && event.ip !== query.ip) return false;
        if (query.userId && event.userId !== query.userId) return false;
        return true;
      });
    } catch (error) {
      console.error('Failed to search security events:', error);
      return [];
    }
  }

  /**
   * Get security statistics
   */
  async getStatistics(): Promise<{
    totalEvents: number;
    eventsByType: Record<SecurityEvent['type'], number>;
    eventsBySeverity: Record<SecurityEvent['severity'], number>;
    recentErrors: number;
  }> {
    try {
      const events = await this.getRecentEvents();
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const stats = {
        totalEvents: events.length,
        eventsByType: {
          auth: 0,
          file: 0,
          network: 0,
          system: 0,
          error: 0,
        },
        eventsBySeverity: {
          info: 0,
          warning: 0,
          error: 0,
          critical: 0,
        },
        recentErrors: 0,
      };

      events.forEach(event => {
        stats.eventsByType[event.type]++;
        stats.eventsBySeverity[event.severity]++;
        if (event.severity === 'error' && event.timestamp > oneHourAgo) {
          stats.recentErrors++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Failed to get security statistics:', error);
      return {
        totalEvents: 0,
        eventsByType: {
          auth: 0,
          file: 0,
          network: 0,
          system: 0,
          error: 0,
        },
        eventsBySeverity: {
          info: 0,
          warning: 0,
          error: 0,
          critical: 0,
        },
        recentErrors: 0,
      };
    }
  }
} 