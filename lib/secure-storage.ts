import sodium from 'libsodium-wrappers'

interface SecureStorage {
  storePrivateKey: (key: string, password: string) => Promise<void>
  retrievePrivateKey: (password: string) => Promise<string | null>
  clearPrivateKey: () => Promise<void>
  hasStoredKey: () => Promise<boolean>
}

// Web Crypto API-based secure storage
class WebCryptoSecureStorage implements SecureStorage {
  private readonly STORAGE_KEY = 'encrypted_private_key'
  private readonly SALT_KEY = 'key_salt'

  async storePrivateKey(key: string, password: string): Promise<void> {
    await sodium.ready
    
    // Generate a random salt for this key
    const salt = sodium.randombytes_buf(32)
    
    // Derive encryption key from password using Argon2
    const derivedKey = sodium.crypto_pwhash(
      32,
      password,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_DEFAULT
    )
    
    // Generate a random IV
    const iv = sodium.randombytes_buf(12) // 96 bits for AES-GCM
    
    // Encrypt the private key
    const keyBytes = sodium.from_base64(key)
    const encrypted = sodium.crypto_secretbox_easy(keyBytes, iv, derivedKey)
    
    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.length)
    combined.set(salt, 0)
    combined.set(iv, salt.length)
    combined.set(encrypted, salt.length + iv.length)
    
    // Store in sessionStorage (cleared on tab close) instead of localStorage
    sessionStorage.setItem(this.STORAGE_KEY, sodium.to_base64(combined))
    sessionStorage.setItem(this.SALT_KEY, sodium.to_base64(salt))
  }

  async retrievePrivateKey(password: string): Promise<string | null> {
    try {
      await sodium.ready
      
      const encryptedData = sessionStorage.getItem(this.STORAGE_KEY)
      if (!encryptedData) return null
      
      const combined = sodium.from_base64(encryptedData)
      
      // Extract salt, IV, and encrypted data
      const salt = combined.slice(0, 32)
      const iv = combined.slice(32, 44) // 12 bytes for AES-GCM
      const encrypted = combined.slice(44)
      
      // Derive the same key from password
      const derivedKey = sodium.crypto_pwhash(
        32,
        password,
        salt,
        sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_ALG_DEFAULT
      )
      
      // Decrypt the private key
      const decrypted = sodium.crypto_secretbox_open_easy(encrypted, iv, derivedKey)
      if (!decrypted) {
        throw new Error('Decryption failed - wrong password or corrupted data')
      }
      
      return sodium.to_base64(decrypted)
    } catch (error) {
      console.error('Failed to retrieve private key:', error)
      return null
    }
  }

  async clearPrivateKey(): Promise<void> {
    sessionStorage.removeItem(this.STORAGE_KEY)
    sessionStorage.removeItem(this.SALT_KEY)
  }

  async hasStoredKey(): Promise<boolean> {
    return sessionStorage.getItem(this.STORAGE_KEY) !== null
  }
}

// Fallback to localStorage with warning (for development only)
class FallbackSecureStorage implements SecureStorage {
  private readonly STORAGE_KEY = 'encrypted_private_key_fallback'

  async storePrivateKey(key: string, password: string): Promise<void> {
    console.warn('⚠️ SECURITY WARNING: Using fallback storage. Private keys are vulnerable to XSS attacks.')
    
    await sodium.ready
    
    // Encrypt with password before storing
    const salt = sodium.randombytes_buf(32)
    const derivedKey = sodium.crypto_pwhash(
      32,
      password,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_DEFAULT
    )
    
    const keyBytes = sodium.from_base64(key)
    const encrypted = sodium.crypto_secretbox_easy(keyBytes, salt, derivedKey)
    
    const combined = new Uint8Array(salt.length + encrypted.length)
    combined.set(salt, 0)
    combined.set(encrypted, salt.length)
    
    localStorage.setItem(this.STORAGE_KEY, sodium.to_base64(combined))
  }

  async retrievePrivateKey(password: string): Promise<string | null> {
    try {
      await sodium.ready
      
      const encryptedData = localStorage.getItem(this.STORAGE_KEY)
      if (!encryptedData) return null
      
      const combined = sodium.from_base64(encryptedData)
      const salt = combined.slice(0, 32)
      const encrypted = combined.slice(32)
      
      const derivedKey = sodium.crypto_pwhash(
        32,
        password,
        salt,
        sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_ALG_DEFAULT
      )
      
      const decrypted = sodium.crypto_secretbox_open_easy(encrypted, salt, derivedKey)
      if (!decrypted) {
        throw new Error('Decryption failed')
      }
      
      return sodium.to_base64(decrypted)
    } catch (error) {
      console.error('Failed to retrieve private key:', error)
      return null
    }
  }

  async clearPrivateKey(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY)
  }

  async hasStoredKey(): Promise<boolean> {
    return localStorage.getItem(this.STORAGE_KEY) !== null
  }
}

// Factory function to get the appropriate storage implementation
export function createSecureStorage(): SecureStorage {
  // Check if Web Crypto API is available and we're in a secure context
  if (typeof window !== 'undefined' && 
      window.crypto && 
      window.crypto.subtle && 
      window.isSecureContext) {
    return new WebCryptoSecureStorage()
  } else {
    return new FallbackSecureStorage()
  }
}

// Export a singleton instance
export const secureStorage = createSecureStorage() 