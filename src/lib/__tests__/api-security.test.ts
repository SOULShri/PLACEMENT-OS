import { NextRequest } from 'next/server';
import { 
  authenticateRequest, 
  authorizeRole, 
  enforceTenant, 
  parsePagination, 
  AuthError 
} from '../auth-api-helpers';
import { generateAccessToken } from '../crypto';

// Setup environment variables for signing tokens in test context
process.env.JWT_SECRET = 'test-secret-key-vjti';

describe('API Security Helpers', () => {
  const testPayload = {
    userId: 'student-uuid',
    email: 'student@vjti.ac.in',
    role: 'STUDENT',
    tenantId: 'tenant-vjti-campus',
  };

  describe('authenticateRequest', () => {
    it('should throw 401 when both cookie and auth headers are missing', () => {
      const mockReq = {
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
      } as unknown as NextRequest;

      expect(() => authenticateRequest(mockReq)).toThrow(AuthError);
      expect(() => authenticateRequest(mockReq)).toThrow('Authentication token missing');
    });

    it('should verify a valid Authorization Header Bearer token', () => {
      const token = generateAccessToken(testPayload);
      const mockReq = {
        headers: {
          get: jest.fn().mockImplementation((header) => {
            if (header === 'authorization') return `Bearer ${token}`;
            return null;
          }),
        },
      } as unknown as NextRequest;

      const payload = authenticateRequest(mockReq);
      expect(payload).toBeDefined();
      expect(payload.userId).toBe(testPayload.userId);
      expect(payload.role).toBe(testPayload.role);
      expect(payload.tenantId).toBe(testPayload.tenantId);
    });

    it('should verify a valid Cookie token', () => {
      const token = generateAccessToken(testPayload);
      const mockReq = {
        headers: {
          get: jest.fn().mockImplementation((header) => {
            if (header === 'cookie') return `accessToken=${token}; OtherCookie=value`;
            return null;
          }),
        },
      } as unknown as NextRequest;

      const payload = authenticateRequest(mockReq);
      expect(payload).toBeDefined();
      expect(payload.userId).toBe(testPayload.userId);
      expect(payload.tenantId).toBe(testPayload.tenantId);
    });

    it('should throw 401 for an invalid token signature', () => {
      const mockReq = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer invalid.payload.signature'),
        },
      } as unknown as NextRequest;

      expect(() => authenticateRequest(mockReq)).toThrow(AuthError);
      expect(() => authenticateRequest(mockReq)).toThrow('Invalid or expired access token');
    });
  });

  describe('authorizeRole', () => {
    it('should allow authorized roles', () => {
      expect(() => authorizeRole(testPayload, ['STUDENT', 'TPO'])).not.toThrow();
    });

    it('should throw 403 for unauthorized roles', () => {
      expect(() => authorizeRole(testPayload, ['TPO', 'RECRUITER'])).toThrow(AuthError);
      expect(() => authorizeRole(testPayload, ['TPO', 'RECRUITER'])).toThrow('Unauthorized role access');
    });
  });

  describe('enforceTenant', () => {
    it('should pass for matching tenantIds', () => {
      expect(() => enforceTenant(testPayload, 'tenant-vjti-campus')).not.toThrow();
    });

    it('should throw 403 for mismatching tenantIds', () => {
      expect(() => enforceTenant(testPayload, 'tenant-other-campus')).toThrow(AuthError);
      expect(() => enforceTenant(testPayload, 'tenant-other-campus')).toThrow('Tenant isolation breach detected');
    });
  });

  describe('parsePagination', () => {
    it('should parse valid page and limit parameters', () => {
      const mockReq = new NextRequest('http://localhost/api/v1/jobs?page=3&limit=25');
      const { skip, take, page, limit } = parsePagination(mockReq);

      expect(page).toBe(3);
      expect(limit).toBe(25);
      expect(skip).toBe(50);
      expect(take).toBe(25);
    });

    it('should fallback to defaults for invalid parameters', () => {
      const mockReq = new NextRequest('http://localhost/api/v1/jobs?page=abc&limit=-12');
      const { skip, take, page, limit } = parsePagination(mockReq);

      expect(page).toBe(1);
      expect(limit).toBe(10);
      expect(skip).toBe(0);
      expect(take).toBe(10);
    });

    it('should cap limit parameter at 100', () => {
      const mockReq = new NextRequest('http://localhost/api/v1/jobs?page=1&limit=500');
      const { limit } = parsePagination(mockReq);

      expect(limit).toBe(100);
    });
  });
});
