import { app } from 'electron';

export const SecurityConfig = {
  // Encryption settings
  encryption: {
    algorithm: 'AES-GCM',
    keyLength: 256,
    ivLength: 12,
    saltLength: 32,
    iterations: 100000,
    hashAlgorithm: 'SHA-256',
  },

  // Session management
  session: {
    timeout: 30 * 60 * 1000, // 30 minutes
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    maxSessions: 10,
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },

  // Browser automation
  automation: {
    timeout: 5 * 60 * 1000, // 5 minutes
    maxConcurrentJobs: 3,
    userDataDir: app.getPath('userData'),
    browserArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  },

  // OAuth settings
  oauth: {
    stateLength: 32,
    codeVerifierLength: 128,
    redirectUri: 'http://localhost:3000/oauth/callback',
    scopes: ['read', 'write'],
  },

  // File system
  fileSystem: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['.json', '.env', '.txt'],
    tempDir: app.getPath('temp'),
  },

  // IPC communication
  ipc: {
    timeout: 30 * 1000, // 30 seconds
    maxRetries: 3,
    retryDelay: 1000, // 1 second
  },

  // Content Security Policy
  csp: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https:'],
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"],
      'sandbox': ['allow-scripts', 'allow-same-origin'],
    },
  },

  // Validation
  validation: {
    apiKey: {
      minLength: 32,
      maxLength: 256,
      pattern: /^[a-zA-Z0-9-_]+$/,
    },
    password: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    },
  },
}; 