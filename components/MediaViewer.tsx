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
}

export default function MediaViewer({ mediaList, initialIndex, onClose }: MediaViewerProps) {
  const [current, setCurrent] = useState(initialIndex)
  const [loading, setLoading] = useState(true)
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const media = mediaList[current]

  // Fetch media (server handles decryption)
  useEffect(() => {
    let url: string | null = null
    setLoading(true)
    setMediaBlob(null)
    setMediaUrl(null)
    async function fetchMedia() {
      const res = await fetch(`/api/media/download?conversationId=${media.conversationId}&filename=${encodeURIComponent(media.mediaUrl.split('/').pop()!)}`)
      if (!res.ok) {
        throw new Error('Failed to fetch media')
      }
      const decrypted = await res.arrayBuffer()
      console.log('MediaViewer: decrypted length', decrypted.byteLength)
      const mimeType = getMimeType(media.type, media.originalFilename)
      console.log('MediaViewer: Blob mimeType', mimeType)
      const blob = new Blob([decrypted], { type: mimeType })
      url = URL.createObjectURL(blob)
      setMediaBlob(blob)
      setMediaUrl(url)
      setLoading(false)
    }
    fetchMedia()
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [current, media])

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
    if (filename.endsWith('.png')) return 'image/png';
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
    if (type === 'image') return 'image/jpeg'; // fallback
    if (type === 'video') return 'video/mp4';
    if (type === 'pdf' || filename.endsWith('.pdf')) return 'application/pdf';
    return 'application/octet-stream';
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
            <video src={mediaUrl!} controls autoPlay className="max-w-full max-h-[70vh] rounded" />
          ) : media.type === 'pdf' ? (
            <iframe src={mediaUrl!} title={media.originalFilename} className="w-full h-[70vh] rounded bg-gray-100" />
          ) : null}
        </div>
        <button onClick={handleDownload} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Download</button>
        <button onClick={() => {
          if (!mediaBlob) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(mediaBlob);
          a.download = 'DEBUG-RAW-' + media.originalFilename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }} className="mt-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">Download Raw Decrypted</button>
      </div>
    </div>
  )
} 