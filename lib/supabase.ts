import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for client-side operations (limited permissions)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations (full permissions)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Storage bucket names
export const STORAGE_BUCKETS = {
  MEDIA: 'media-files',
  THUMBNAILS: 'thumbnails'
} as const

// Initialize storage buckets if they don't exist
export async function initializeStorage() {
  try {
    // Check if buckets exist
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketNames = buckets?.map(b => b.name) || []

    // Create media bucket if it doesn't exist
    if (!bucketNames.includes(STORAGE_BUCKETS.MEDIA)) {
      await supabaseAdmin.storage.createBucket(STORAGE_BUCKETS.MEDIA, {
        public: false,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/*', 'video/*', 'application/pdf']
      })
    }

    // Create thumbnails bucket if it doesn't exist
    if (!bucketNames.includes(STORAGE_BUCKETS.THUMBNAILS)) {
      await supabaseAdmin.storage.createBucket(STORAGE_BUCKETS.THUMBNAILS, {
        public: false,
        fileSizeLimit: 1048576, // 1MB
        allowedMimeTypes: ['image/*']
      })
    }

    console.log('✅ Storage buckets initialized')
  } catch (error) {
    console.error('❌ Error initializing storage:', error)
  }
}

// Upload file to Supabase Storage
export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: true
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  return data.path
}

// Download file from Supabase Storage
export async function downloadFile(bucket: string, path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .download(path)

  if (error) {
    throw new Error(`Download failed: ${error.message}`)
  }

  return Buffer.from(await data.arrayBuffer())
}

// Delete file from Supabase Storage
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .remove([path])

  if (error) {
    throw new Error(`Delete failed: ${error.message}`)
  }
}

// Get public URL for file (if needed)
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path)

  return data.publicUrl
} 