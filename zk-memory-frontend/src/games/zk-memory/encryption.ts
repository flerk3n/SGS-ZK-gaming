/**
 * Encryption utilities for secure deck data sharing
 * Uses Web Crypto API with AES-GCM encryption
 */

/**
 * Generate a random encryption key
 * @returns Base64 encoded encryption key
 */
export async function generateEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
  
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

/**
 * Encrypt deck data with a key
 * @param data - The deck data object to encrypt
 * @param keyBase64 - Base64 encoded encryption key
 * @returns Base64 encoded encrypted data with IV
 */
export async function encryptDeckData(
  data: { deck: number[]; salt: string; commitment: string },
  keyBase64: string
): Promise<string> {
  // Import the key
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the data
  const encoder = new TextEncoder();
  const dataStr = JSON.stringify(data);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(dataStr)
  );
  
  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt deck data with a key
 * @param encryptedBase64 - Base64 encoded encrypted data with IV
 * @param keyBase64 - Base64 encoded encryption key
 * @returns Decrypted deck data object
 */
export async function decryptDeckData(
  encryptedBase64: string,
  keyBase64: string
): Promise<{ deck: number[]; salt: string; commitment: string }> {
  // Import the key
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  // Decode the combined data
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  
  // Parse JSON
  const decoder = new TextDecoder();
  const dataStr = decoder.decode(decrypted);
  return JSON.parse(dataStr);
}

/**
 * Derive an encryption key from a password
 * Useful for password-based encryption
 * @param password - User password
 * @param salt - Optional salt (generated if not provided)
 * @returns Object with key (base64) and salt (base64)
 */
export async function deriveKeyFromPassword(
  password: string,
  salt?: string
): Promise<{ key: string; salt: string }> {
  const encoder = new TextEncoder();
  
  // Generate or decode salt
  const saltBytes = salt
    ? Uint8Array.from(atob(salt), c => c.charCodeAt(0))
    : crypto.getRandomValues(new Uint8Array(16));
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  // Export key
  const exported = await crypto.subtle.exportKey('raw', key);
  const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  const saltBase64 = btoa(String.fromCharCode(...saltBytes));
  
  return { key: keyBase64, salt: saltBase64 };
}
