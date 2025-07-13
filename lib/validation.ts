import { z } from 'zod'

// Base schemas
export const emailSchema = z.string().email('Invalid email address')
export const cuidSchema = z.string().cuid('Invalid ID format')
export const nonEmptyStringSchema = z.string().min(1, 'Cannot be empty').max(1000, 'Too long')

// User-related schemas
export const userSetupKeysSchema = z.object({
  publicKey: z.string().min(1, 'Public key is required'),
  encryptedPrivateKey: z.string().min(1, 'Encrypted private key is required')
})

export const userPasswordSchema = z.object({
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
})

// Conversation schemas
export const createConversationSchema = z.object({
  participantEmails: z.array(emailSchema).min(1, 'At least one participant is required').max(10, 'Too many participants'),
  isGroup: z.boolean(),
  name: z.string().optional().refine(
    (name) => !name || (name.length >= 1 && name.length <= 100),
    'Group name must be between 1 and 100 characters'
  )
})

export const conversationIdSchema = z.object({
  conversationId: cuidSchema
})

// Message schemas
export const sendMessageSchema = z.object({
  conversationId: cuidSchema,
  content: nonEmptyStringSchema.max(10000, 'Message too long')
})

export const messageIdSchema = z.object({
  messageId: cuidSchema
})

// Media upload schemas
export const mediaUploadSchema = z.object({
  conversationId: cuidSchema,
  type: z.enum(['image', 'video', 'pdf']),
  originalFilename: z.string()
    .min(1, 'Filename is required')
    .max(255, 'Filename too long')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename characters'),
  file: z.instanceof(File).refine(
    (file) => file.size <= 10 * 1024 * 1024, // 10MB
    'File size must be 10MB or less'
  )
})

// File validation schemas
export const allowedImageTypes = ['image/jpeg', 'image/png'] as const
export const allowedVideoTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/mov'] as const
export const allowedPdfTypes = ['application/pdf'] as const

export const imageFileSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => allowedImageTypes.includes(file.type as any),
    'Only JPEG and PNG images are allowed'
  ).refine(
    (file) => file.size <= 10 * 1024 * 1024,
    'Image must be 10MB or less'
  )
})

export const videoFileSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => allowedVideoTypes.includes(file.type as any),
    'Only MP4, AVI, MOV, and QuickTime videos are allowed'
  ).refine(
    (file) => file.size <= 10 * 1024 * 1024,
    'Video must be 10MB or less'
  )
})

export const pdfFileSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => allowedPdfTypes.includes(file.type as any),
    'Only PDF files are allowed'
  ).refine(
    (file) => file.size <= 10 * 1024 * 1024,
    'PDF must be 10MB or less'
  )
})

// API endpoint validation schemas
export const apiSchemas = {
  // User endpoints
  setupKeys: userSetupKeysSchema,
  changePassword: userPasswordSchema,
  
  // Conversation endpoints
  createConversation: createConversationSchema,
  getConversation: conversationIdSchema,
  getConversationKeys: conversationIdSchema,
  setConversationKeys: z.object({
    conversationId: cuidSchema,
    encryptedSymmetricKey: z.string().min(1, 'Encrypted key is required')
  }),
  
  // Message endpoints
  sendMessage: sendMessageSchema,
  getMessages: z.object({
    conversationId: cuidSchema,
    limit: z.number().int().min(1).max(100).optional().default(50),
    before: cuidSchema.optional()
  }),
  
  // Media endpoints
  uploadMedia: mediaUploadSchema,
  downloadMedia: z.object({
    conversationId: cuidSchema,
    filename: z.string().min(1).max(255)
  })
}

// Validation helper functions
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { 
      success: false, 
      errors: result.error.issues.map(issue => issue.message)
    }
  }
}

// Sanitization helpers
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .substring(0, 255) // Limit length
}

export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 1000) // Limit length
}

// Security validation helpers
export function validateFileContent(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer
      const uint8Array = new Uint8Array(arrayBuffer)
      
      // Check for common file signatures
      const isImage = checkImageSignature(uint8Array)
      const isVideo = checkVideoSignature(uint8Array)
      const isPdf = checkPdfSignature(uint8Array)
      
      resolve(isImage || isVideo || isPdf)
    }
    reader.readAsArrayBuffer(file)
  })
}

function checkImageSignature(bytes: Uint8Array): boolean {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true
  return false
}

function checkVideoSignature(bytes: Uint8Array): boolean {
  // MP4: ftyp box
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return true
  // AVI: RIFF
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true
  return false
}

function checkPdfSignature(bytes: Uint8Array): boolean {
  // PDF: %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return true
  return false
} 