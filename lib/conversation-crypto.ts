import sodium from 'libsodium-wrappers'
import { prisma } from '@/lib/prisma'

// Secure conversation key derivation
export async function deriveConversationKey(conversationId: string, userEmail: string): Promise<Buffer> {
  await sodium.ready
  
  // Get conversation participants to create a deterministic but secure key
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { include: { user: true } } }
  })
  
  if (!conversation) {
    throw new Error('Conversation not found')
  }
  
  // Create a deterministic seed from conversation data
  const participantEmails = conversation.participants
    .map(p => p.user.email)
    .sort() // Ensure deterministic ordering
  
  const seed = `${conversationId}:${participantEmails.join(':')}`
  
  // Use PBKDF2-like derivation for server-side compatibility
  const salt = await getConversationSalt(conversationId)
  const derivedKey = sodium.crypto_generichash(
    32, // 32 bytes for crypto_secretbox
    seed + sodium.to_base64(salt)
  )
  
  return Buffer.from(derivedKey)
}

// Get or create a salt for a conversation
async function getConversationSalt(conversationId: string): Promise<Uint8Array> {
  await sodium.ready
  
  // Try to get existing salt from database
  const existingSalt = await prisma.conversationSalt.findUnique({
    where: { conversationId }
  })
  
  if (existingSalt) {
    return sodium.from_base64(existingSalt.salt)
  }
  
  // Generate new salt
  const salt = sodium.randombytes_buf(32)
  
  // Store salt in database
  try {
    await prisma.conversationSalt.create({
      data: {
        conversationId,
        salt: sodium.to_base64(salt)
      }
    })
  } catch (error: any) {
    // If salt already exists, try to get it again
    if (error.code === 'P2002') {
      const existingSalt = await prisma.conversationSalt.findUnique({
        where: { conversationId }
      })
      if (existingSalt) {
        return sodium.from_base64(existingSalt.salt)
      }
    }
    throw error
  }
  
  return salt
}

// Encrypt media with conversation-specific key
export async function encryptMedia(buffer: Buffer, conversationId: string, userEmail: string): Promise<Buffer> {
  const key = await deriveConversationKey(conversationId, userEmail)
  return await encryptBuffer(buffer, key)
}

// Decrypt media with conversation-specific key
export async function decryptMedia(encryptedBuffer: Buffer, conversationId: string, userEmail: string): Promise<Buffer> {
  const key = await deriveConversationKey(conversationId, userEmail)
  return await decryptBuffer(encryptedBuffer, key)
}

// Encrypt buffer with key
async function encryptBuffer(buffer: Buffer, key: Buffer): Promise<Buffer> {
  await sodium.ready
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = sodium.crypto_secretbox_easy(
    new Uint8Array(buffer), 
    nonce, 
    new Uint8Array(key)
  )
  // Store as: nonce + ciphertext
  return Buffer.concat([Buffer.from(nonce), Buffer.from(ciphertext)])
}

// Decrypt buffer with key
async function decryptBuffer(encryptedBuffer: Buffer, key: Buffer): Promise<Buffer> {
  await sodium.ready
  const nonce = encryptedBuffer.slice(0, sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = encryptedBuffer.slice(sodium.crypto_secretbox_NONCEBYTES)
  
  const decrypted = sodium.crypto_secretbox_open_easy(
    new Uint8Array(ciphertext),
    new Uint8Array(nonce),
    new Uint8Array(key)
  )
  
  if (!decrypted) {
    throw new Error('Decryption failed')
  }
  
  return Buffer.from(decrypted)
}

// Validate user has access to conversation
export async function validateConversationAccess(conversationId: string, userEmail: string): Promise<boolean> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { include: { user: true } } }
  })
  
  if (!conversation) {
    return false
  }
  
  return conversation.participants.some(p => p.user.email === userEmail)
} 