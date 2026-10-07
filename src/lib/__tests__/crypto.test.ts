import {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken
} from '../crypto';

describe('Cryptographic Helpers', () => {
  // Test AES encryption/decryption
  describe('AES-256-GCM', () => {
    it('should encrypt and decrypt text correctly', () => {
      const originalText = '+91-9876543210';
      const encrypted = encrypt(originalText);
      expect(encrypted).not.toBe(originalText);
      expect(encrypted).toContain(':'); // contains IV:TAG:EncryptedText split format

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(originalText);
    });

    it('should throw error for invalid encrypted data format', () => {
      expect(() => decrypt('invalid-format')).toThrow();
    });
  });

  // Test JWT tokens
  describe('JWT Operations', () => {
    const payload = {
      userId: 'user-uuid-1234',
      email: 'test@vjti.ac.in',
      role: 'STUDENT',
      tenantId: 'vjti-campus-id'
    };

    it('should generate valid access and refresh tokens', () => {
      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();

      const decoded = verifyToken(accessToken);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.tenantId).toBe(payload.tenantId);
    });
  });

  // Test Argon2id password hashing
  describe('Argon2id Hashing', () => {
    it('should hash and successfully verify a password', async () => {
      const password = 'mySecurePassword123';
      const hash = await hashPassword(password);

      expect(hash).toContain('$argon2id$'); // Phc formatted output
      
      const isMatch = await verifyPassword(password, hash);
      expect(isMatch).toBe(true);

      const isMismatch = await verifyPassword('wrongPassword', hash);
      expect(isMismatch).toBe(false);
    });
  });
});
