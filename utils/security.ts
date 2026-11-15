/**
 * NotesBazaar Security Architecture Utilities
 * - Salted SHA-256 Admin Vault passphrase verification via Web Crypto API
 * - Brute-force rate limiting with 60s lockout timer
 * - Time-limited Admin Vault session token (30-min idle expiry)
 * - XSS-safe URL & text sanitization + PDF/Image validation
 */

export const FOUNDER_ADMIN_EMAILS = [
  'yugalofficial63@gmail.com',
  'yugalna28@gmail.com',
];

export const isFounderEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return FOUNDER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

// Local storage & session keys
const VAULT_SESSION_KEY = 'nb_admin_vault_session_v1';
const VAULT_HASH_KEY = 'nb_admin_vault_hash_v1';
const ATTEMPTS_KEY = 'nb_admin_sec_attempts';
const LOCKOUT_KEY = 'nb_admin_lockout_until';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds cooldown
const VAULT_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes active unlock session

export interface StoredVaultCredential {
  salt: string;
  hash: string;
  updatedAt: string;
  updatedBy?: string;
}

export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSaltHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashVaultPasscode(passcode: string, salt: string): Promise<string> {
  return sha256Hex(`NB_SEC_VAULT::${salt}::${passcode}`);
}

export function getLocalVaultCredential(): StoredVaultCredential | null {
  try {
    const raw = localStorage.getItem(VAULT_HASH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.salt === 'string' && typeof parsed.hash === 'string') {
      return parsed;
    }
  } catch (e) {}
  return null;
}

export function saveLocalVaultCredential(cred: StoredVaultCredential): void {
  try {
    localStorage.setItem(VAULT_HASH_KEY, JSON.stringify(cred));
  } catch (e) {}
}

export async function verifyVaultPasscode(
  passcode: string,
  credential: StoredVaultCredential
): Promise<boolean> {
  const candidate = await hashVaultPasscode(passcode, credential.salt);
  // Constant-time-style comparison
  if (candidate.length !== credential.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ credential.hash.charCodeAt(i);
  }
  return diff === 0;
}

export function checkAdminLockout(): { locked: boolean; remainingSeconds: number; attempts: number } {
  try {
    const now = Date.now();
    const lockedUntil = Number(localStorage.getItem(LOCKOUT_KEY) || '0');
    const attempts = Number(localStorage.getItem(ATTEMPTS_KEY) || '0');
    if (lockedUntil > now) {
      return {
        locked: true,
        remainingSeconds: Math.ceil((lockedUntil - now) / 1000),
        attempts,
      };
    }
    return { locked: false, remainingSeconds: 0, attempts };
  } catch (e) {
    return { locked: false, remainingSeconds: 0, attempts: 0 };
  }
}

export function recordFailedAdminAttempt(): { locked: boolean; remainingSeconds: number; attempts: number } {
  try {
    const current = Number(localStorage.getItem(ATTEMPTS_KEY) || '0') + 1;
    localStorage.setItem(ATTEMPTS_KEY, String(current));
    if (current >= MAX_FAILED_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_DURATION_MS;
      localStorage.setItem(LOCKOUT_KEY, String(until));
      localStorage.setItem(ATTEMPTS_KEY, '0');
      return {
        locked: true,
        remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        attempts: MAX_FAILED_ATTEMPTS,
      };
    }
    return { locked: false, remainingSeconds: 0, attempts: current };
  } catch (e) {
    return { locked: false, remainingSeconds: 0, attempts: 1 };
  }
}

export function resetAdminLockout(): void {
  try {
    localStorage.removeItem(ATTEMPTS_KEY);
    localStorage.removeItem(LOCKOUT_KEY);
  } catch (e) {}
}

export function isAdminVaultSessionActive(userEmail?: string | null): boolean {
  try {
    const raw = sessionStorage.getItem(VAULT_SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.expiresAt !== 'number') return false;
    if (Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(VAULT_SESSION_KEY);
      return false;
    }
    if (userEmail && parsed.email && parsed.email.toLowerCase() !== userEmail.toLowerCase()) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

export function unlockAdminVaultSession(userEmail?: string | null): void {
  try {
    sessionStorage.setItem(
      VAULT_SESSION_KEY,
      JSON.stringify({
        unlockedAt: Date.now(),
        expiresAt: Date.now() + VAULT_SESSION_TTL_MS,
        email: (userEmail || '').toLowerCase(),
      })
    );
  } catch (e) {}
}

export function lockAdminVaultSession(): void {
  try {
    sessionStorage.removeItem(VAULT_SESSION_KEY);
  } catch (e) {}
}

/**
 * Sanitizes external or data URLs to reject dangerous protocols like javascript:, vbscript:, data:text/html
 */
export function isSafeAssetUrl(url: string, allowRelativeHash = false): boolean {
  const trimmed = (url || '').trim();
  if (!trimmed) return false;
  if (allowRelativeHash && trimmed === '#') return true;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html') ||
    lower.startsWith('data:application/javascript')
  ) {
    return false;
  }
  return (
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('data:image/') ||
    lower.startsWith('data:application/pdf') ||
    lower.startsWith('/')
  );
}

export function sanitizePlainText(input: string, maxLen = 500): string {
  return (input || '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Compresses an uploaded preview image file into a crisp WebP/JPEG data URL
 * so preview sheets stay compact even if Firebase Storage bucket rules are restricted.
 */
export function compressImageFileToDataUrl(file: File, maxWidth = 1100, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
