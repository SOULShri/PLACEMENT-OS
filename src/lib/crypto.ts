import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { argon2id } from 'hash-wasm';

const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.scryptSync(process.env.ENCRYPTION_SECRET || 'fallback-vjti-placement-os-key-32-chars', 'salt-vjti', 32);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret';

// --- AES-256-GCM Encryption / Decryption ---

export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  if (!encryptedData) return '';
  const [ivHex, tagHex, encryptedText] = encryptedData.split(':');
  if (!ivHex || !tagHex || !encryptedText) {
    throw new Error('Invalid encrypted data format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// --- JWT Tokens Generator ---

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

// --- Argon2id Password Hashing (hash-wasm) ---

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  // standard parameters for Argon2id recommended by OWASP
  return argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 2,
    memorySize: 15360, // 15MB memory usage
    hashLength: 32,
    outputType: 'encoded', // returns PHC string format
  });
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Parse PHC format to extract salt and parameters
    // $argon2id$v=19$m=15360,t=2,p=1$<salt>$<hash>
    const parts = storedHash.split('$');
    if (parts.length < 6) {
      return false;
    }

    const paramsStr = parts[3];
    const saltBase64 = parts[4];
    
    // Parse parameters
    const params: Record<string, number> = {};
    paramsStr.split(',').forEach((param) => {
      const [key, val] = param.split('=');
      params[key] = parseInt(val, 10);
    });

    const salt = Buffer.from(saltBase64, 'base64');

    const checkHash = await argon2id({
      password,
      salt,
      parallelism: params.p || 1,
      iterations: params.t || 2,
      memorySize: params.m || 15360,
      hashLength: 32,
      outputType: 'encoded',
    });

    return checkHash === storedHash;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}
