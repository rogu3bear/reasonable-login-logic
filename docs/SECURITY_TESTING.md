# Security Testing Guide

This guide provides comprehensive instructions for testing security features in the API Credential Manager application.

## Prerequisites

- Node.js 16.x or later
- npm 7.x or later
- Playwright for browser automation testing
- OWASP ZAP for security scanning (optional)

## Test Categories

### 1. Authentication Testing

#### Password Requirements
```typescript
describe('Password Validation', () => {
  it('should reject passwords shorter than 12 characters', () => {
    const result = SecurityUtils.validatePassword('short');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must be at least 12 characters long');
  });

  it('should reject passwords without uppercase letters', () => {
    const result = SecurityUtils.validatePassword('lowercase123!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  // Add more test cases...
});
```

#### Session Management
```typescript
describe('Session Management', () => {
  it('should expire sessions after 30 minutes', async () => {
    // Test implementation
  });

  it('should limit concurrent sessions to 10', async () => {
    // Test implementation
  });

  it('should clean up expired sessions', async () => {
    // Test implementation
  });
});
```

### 2. Encryption Testing

#### Key Derivation
```typescript
describe('Key Derivation', () => {
  it('should generate consistent keys for same password', async () => {
    const password = 'TestPassword123!';
    const salt = await generateSalt();
    const key1 = await deriveKeyFromPassword(password, salt);
    const key2 = await deriveKeyFromPassword(password, salt);
    expect(key1).toEqual(key2);
  });

  it('should generate different keys for different salts', async () => {
    const password = 'TestPassword123!';
    const salt1 = await generateSalt();
    const salt2 = await generateSalt();
    const key1 = await deriveKeyFromPassword(password, salt1);
    const key2 = await deriveKeyFromPassword(password, salt2);
    expect(key1).not.toEqual(key2);
  });
});
```

#### Data Encryption
```typescript
describe('Data Encryption', () => {
  it('should encrypt and decrypt data correctly', async () => {
    const data = 'sensitive data';
    const key = await generateEncryptionKey();
    const encrypted = await encryptValue(data, key);
    const decrypted = await decryptValue(encrypted, key);
    expect(decrypted).toBe(data);
  });

  it('should fail decryption with wrong key', async () => {
    const data = 'sensitive data';
    const key1 = await generateEncryptionKey();
    const key2 = await generateEncryptionKey();
    const encrypted = await encryptValue(data, key1);
    await expect(decryptValue(encrypted, key2)).rejects.toThrow();
  });
});
```

### 3. API Security Testing

#### Rate Limiting
```typescript
describe('Rate Limiting', () => {
  it('should limit requests to 100 per 15 minutes', async () => {
    const requests = Array(101).fill(null).map(() => 
      fetch('/api/endpoint')
    );
    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status);
    expect(statusCodes.filter(code => code === 429)).toHaveLength(1);
  });

  it('should reset rate limit after window', async () => {
    // Test implementation
  });
});
```

#### Input Validation
```typescript
describe('Input Validation', () => {
  it('should validate API key format', () => {
    const result = SecurityUtils.validateApiKey('invalid-key');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('API key contains invalid characters');
  });

  it('should reject oversized requests', async () => {
    const largeData = 'x'.repeat(11 * 1024 * 1024); // 11MB
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: largeData,
    });
    expect(response.status).toBe(413);
  });
});
```

### 4. File System Security Testing

#### Path Traversal
```typescript
describe('Path Traversal Prevention', () => {
  it('should prevent directory traversal attacks', async () => {
    const maliciousPath = '../../../etc/passwd';
    await expect(
      SecurityUtils.sanitizeFilePath(maliciousPath)
    ).rejects.toThrow('Invalid file path');
  });

  it('should allow valid file paths', async () => {
    const validPath = 'documents/file.txt';
    const sanitized = await SecurityUtils.sanitizeFilePath(validPath);
    expect(sanitized).toBe(validPath);
  });
});
```

#### File Permissions
```typescript
describe('File Permissions', () => {
  it('should set correct file permissions', async () => {
    const filePath = 'test.txt';
    await fs.writeFile(filePath, 'test');
    const stats = await fs.stat(filePath);
    expect(stats.mode & 0o777).toBe(0o600); // Owner read/write only
  });
});
```

### 5. Browser Security Testing

#### Automation Security
```typescript
describe('Browser Automation Security', () => {
  it('should use secure browser arguments', async () => {
    const browser = await launchBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Verify secure settings
    const args = await page.evaluate(() => process.argv);
    expect(args).toContain('--no-sandbox');
    expect(args).toContain('--disable-setuid-sandbox');
  });

  it('should handle timeouts gracefully', async () => {
    // Test implementation
  });
});
```

### 6. Network Security Testing

#### HTTPS
```typescript
describe('HTTPS Security', () => {
  it('should enforce HTTPS', async () => {
    const response = await fetch('http://localhost:3000', {
      redirect: 'follow',
    });
    expect(response.url).toMatch(/^https:/);
  });
});
```

#### CSP Headers
```typescript
describe('Content Security Policy', () => {
  it('should include all required CSP headers', async () => {
    const response = await fetch('/');
    const headers = response.headers;
    
    expect(headers.get('content-security-policy')).toBeDefined();
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('x-frame-options')).toBe('DENY');
  });
});
```

## Running Security Tests

### Automated Tests
```bash
# Run all security tests
npm run test:security

# Run specific test category
npm run test:security -- --grep "Authentication"
```

### Manual Testing Checklist

1. Authentication
   - [ ] Test password requirements
   - [ ] Test session management
   - [ ] Test account lockout
   - [ ] Test password reset flow

2. Encryption
   - [ ] Test key derivation
   - [ ] Test data encryption/decryption
   - [ ] Test key storage
   - [ ] Test key rotation

3. API Security
   - [ ] Test rate limiting
   - [ ] Test input validation
   - [ ] Test error handling
   - [ ] Test CORS configuration

4. File System
   - [ ] Test path traversal prevention
   - [ ] Test file permissions
   - [ ] Test file type validation
   - [ ] Test size limits

5. Browser Security
   - [ ] Test automation security
   - [ ] Test resource limits
   - [ ] Test error handling
   - [ ] Test timeout handling

6. Network Security
   - [ ] Test HTTPS enforcement
   - [ ] Test security headers
   - [ ] Test cookie security
   - [ ] Test CORS configuration

## Security Scanning

### OWASP ZAP Scan
1. Install OWASP ZAP
2. Configure target URL
3. Run active scan
4. Review findings
5. Address vulnerabilities

### Dependency Scanning
```bash
# Run npm audit
npm audit

# Run Snyk scan
snyk test

# Run OSS Index scan
npm run security:scan
```

## Reporting Security Issues

1. Document the issue:
   - Description
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment details

2. Create a security advisory:
   - Severity assessment
   - Impact analysis
   - Mitigation steps
   - Timeline

3. Update documentation:
   - Security policy
   - Testing guide
   - Known issues

## Continuous Security Testing

### GitHub Actions Workflow
```yaml
name: Security Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm ci
      - name: Run security tests
        run: npm run test:security
      - name: Run dependency scan
        run: npm audit
      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

## Resources

- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#security)
- [Electron Security Guidelines](https://www.electronjs.org/docs/tutorial/security)
- [TypeScript Security Best Practices](https://github.com/typescript-eslint/typescript-eslint/blob/master/docs/getting-started/security.md) 