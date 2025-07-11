import React, { useEffect, useRef, useState } from 'react'
import sodium from 'libsodium-wrappers'

interface MediaMessage {
  mediaUrl: string
  thumbnailUrl: string
  type: 'image' | 'video' | 'pdf'
  originalFilename: string
  conversationId: string
}

interface MediaViewerProps {
  mediaList: MediaMessage[]
  initialIndex: number
  onClose: () => void
  conversationKey: Uint8Array // 32 bytes
}

export default function MediaViewer({ mediaList, initialIndex, onClose, conversationKey }: MediaViewerProps) {
  const [current, setCurrent] = useState(initialIndex)
  const [loading, setLoading] = useState(true)
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const media = mediaList[current]

  // Fetch and decrypt media
  useEffect(() => {
    let url: string | null = null
    setLoading(true)
    setMediaBlob(null)
    setMediaUrl(null)
    async function fetchAndDecrypt() {
      await sodium.ready
      const res = await fetch(`/api/media/download?conversationId=${media.conversationId}&filename=${encodeURIComponent(media.mediaUrl.split('/').pop()!)}`)
      const encrypted = new Uint8Array(await res.arrayBuffer())
      const nonce = encrypted.slice(0, sodium.crypto_secretbox_NONCEBYTES)
      const ciphertext = encrypted.slice(sodium.crypto_secretbox_NONCEBYTES)
      const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, conversationKey)
      if (!decrypted) throw new Error('Decryption failed')
      const blob = new Blob([decrypted], { type: getMimeType(media.type, media.originalFilename) })
      url = URL.createObjectURL(blob)
      setMediaBlob(blob)
      setMediaUrl(url)
      setLoading(false)
    }
    fetchAndDecrypt()
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [current, media, conversationKey])

  // Keyboard navigation and close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setCurrent(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setCurrent(i => Math.min(mediaList.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mediaList.length, onClose])

  // Close on outside click
  function onBackdrop(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  function getMimeType(type: string, filename: string) {
    if (type === 'image') return 'image/jpeg'
    if (type === 'video') return 'video/mp4'
    if (type === 'pdf' || filename.endsWith('.pdf')) return 'application/pdf'
    return 'application/octet-stream'
  }

  function handleDownload() {
    if (!mediaBlob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(mediaBlob)
    a.download = media.originalFilename
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center" onClick={onBackdrop}>
      <div className="relative bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] flex flex-col items-center p-4">
        <button className="absolute top-2 right-2 text-gray-500 hover:text-black text-2xl" onClick={onClose}>&times;</button>
        <div className="flex items-center justify-between w-full mb-2">
          <button onClick={() => setCurrent(i => Math.max(0, i - 1))} disabled={current === 0} className="text-2xl px-2 disabled:opacity-30">&#8592;</button>
          <span className="text-sm text-gray-700">{media.originalFilename}</span>
          <button onClick={() => setCurrent(i => Math.min(mediaList.length - 1, i + 1))} disabled={current === mediaList.length - 1} className="text-2xl px-2 disabled:opacity-30">&#8594;</button>
        </div>
        <div className="flex-1 flex items-center justify-center w-full max-h-[70vh]">
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : media.type === 'image' ? (
            <img src={mediaUrl!} alt={media.originalFilename} className="max-w-full max-h-[70vh] rounded" />
          ) : media.type === 'video' ? (
            <video src={mediaUrl!} controls className="max-w-full max-h-[70vh] rounded" />
          ) : media.type === 'pdf' ? (
            <iframe src={mediaUrl!} title={media.originalFilename} className="w-full h-[70vh] rounded bg-gray-100" />
          ) : null}
        </div>
        <button onClick={handleDownload} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Download</button>
      </div>
    </div>
  )
} 