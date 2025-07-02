import sodium from 'libsodium-wrappers'

export interface KeyPair {
  publicKey: string
  privateKey: string
}

// Initialize sodium
let sodiumReady = false
async function ensureSodiumReady() {
  if (!sodiumReady) {
    await sodium.ready
    sodiumReady = true
  }
}

export interface EncryptedData {
  ciphertext: string
  nonce: string
}

// Generate a new keypair for a user
export async function generateKeyPair(): Promise<KeyPair> {
  await ensureSodiumReady()
  const keypair = sodium.crypto_box_keypair()
  
  return {
    publicKey: sodium.to_base64(keypair.publicKey),
    privateKey: sodium.to_base64(keypair.privateKey)
  }
}

// Encrypt a private key with a password
export async function encryptPrivateKey(privateKey: string, password: string): Promise<string> {
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES)
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  )
  
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = sodium.crypto_secretbox_easy(
    sodium.from_base64(privateKey),
    nonce,
    key
  )
  
  const encrypted = new Uint8Array(salt.length + nonce.length + ciphertext.length)
  encrypted.set(salt, 0)
  encrypted.set(nonce, salt.length)
  encrypted.set(ciphertext, salt.length + nonce.length)
  
  return sodium.to_base64(encrypted)
}

// Decrypt a private key with a password
export async function decryptPrivateKey(encryptedPrivateKey: string, password: string): Promise<string> {
  const encrypted = sodium.from_base64(encryptedPrivateKey)
  
  const salt = encrypted.slice(0, sodium.crypto_pwhash_SALTBYTES)
  const nonce = encrypted.slice(
    sodium.crypto_pwhash_SALTBYTES,
    sodium.crypto_pwhash_SALTBYTES + sodium.crypto_secretbox_NONCEBYTES
  )
  const ciphertext = encrypted.slice(sodium.crypto_pwhash_SALTBYTES + sodium.crypto_secretbox_NONCEBYTES)
  
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  )
  
  const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key)
  return sodium.to_base64(decrypted)
}

// Generate a symmetric key for a conversation
export async function generateSymmetricKey(): Promise<string> {
  const key = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES)
  return sodium.to_base64(key)
}

// Encrypt a symmetric key with a user's public key
export async function encryptSymmetricKey(symmetricKey: string, recipientPublicKey: string): Promise<string> {
  const ephemeralKeypair = sodium.crypto_box_keypair()
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
  
  const ciphertext = sodium.crypto_box_easy(
    sodium.from_base64(symmetricKey),
    nonce,
    sodium.from_base64(recipientPublicKey),
    ephemeralKeypair.privateKey
  )
  
  const encrypted = new Uint8Array(ephemeralKeypair.publicKey.length + nonce.length + ciphertext.length)
  encrypted.set(ephemeralKeypair.publicKey, 0)
  encrypted.set(nonce, ephemeralKeypair.publicKey.length)
  encrypted.set(ciphertext, ephemeralKeypair.publicKey.length + nonce.length)
  
  return sodium.to_base64(encrypted)
}

// Decrypt a symmetric key with a user's private key
export async function decryptSymmetricKey(encryptedSymmetricKey: string, privateKey: string): Promise<string> {
  const encrypted = sodium.from_base64(encryptedSymmetricKey)
  
  const ephemeralPublicKey = encrypted.slice(0, sodium.crypto_box_PUBLICKEYBYTES)
  const nonce = encrypted.slice(
    sodium.crypto_box_PUBLICKEYBYTES,
    sodium.crypto_box_PUBLICKEYBYTES + sodium.crypto_box_NONCEBYTES
  )
  const ciphertext = encrypted.slice(sodium.crypto_box_PUBLICKEYBYTES + sodium.crypto_box_NONCEBYTES)
  
  const decrypted = sodium.crypto_box_open_easy(
    ciphertext,
    nonce,
    ephemeralPublicKey,
    sodium.from_base64(privateKey)
  )
  
  return sodium.to_base64(decrypted)
}

// Encrypt a message with a symmetric key
export async function encryptMessage(message: string, symmetricKey: string): Promise<EncryptedData> {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = sodium.crypto_secretbox_easy(
    sodium.from_string(message),
    nonce,
    sodium.from_base64(symmetricKey)
  )
  
  return {
    ciphertext: sodium.to_base64(ciphertext),
    nonce: sodium.to_base64(nonce)
  }
}

// Decrypt a message with a symmetric key
export async function decryptMessage(encryptedData: EncryptedData, symmetricKey: string): Promise<string> {
  const decrypted = sodium.crypto_secretbox_open_easy(
    sodium.from_base64(encryptedData.ciphertext),
    sodium.from_base64(encryptedData.nonce),
    sodium.from_base64(symmetricKey)
  )
  
  return sodium.to_string(decrypted)
}

// Combine ciphertext and nonce for storage
export function combineCiphertextAndNonce(ciphertext: string, nonce: string): string {
  const combined = new Uint8Array(sodium.from_base64(ciphertext).length + sodium.from_base64(nonce).length)
  combined.set(sodium.from_base64(nonce), 0)
  combined.set(sodium.from_base64(ciphertext), sodium.from_base64(nonce).length)
  return sodium.to_base64(combined)
}

// Separate ciphertext and nonce from storage
export function separateCiphertextAndNonce(combined: string): EncryptedData {
  const data = sodium.from_base64(combined)
  const nonce = data.slice(0, sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = data.slice(sodium.crypto_secretbox_NONCEBYTES)
  
  return {
    ciphertext: sodium.to_base64(ciphertext),
    nonce: sodium.to_base64(nonce)
  }
} 