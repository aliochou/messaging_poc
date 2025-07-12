'use client'

import { useState, useEffect, useRef } from 'react'
import { PencilIcon } from '@heroicons/react/24/outline'
import MediaViewer from './MediaViewer'
import sodium from 'libsodium-wrappers'

interface Message {
  id: string
  ciphertext: string
  createdAt: string
  sender: {
    id: string
    name?: string
    email: string
    image?: string
  }
  type: string
  mediaUrl?: string
  thumbnailUrl?: string
  originalFilename?: string
}

interface ChatInterfaceProps {
  conversationId: string
  currentUserEmail: string
  refreshConversations?: () => void
}

interface MediaUploadResponse {
  mediaUrl: string;
  thumbnailUrl: string;
  originalFilename: string;
}

interface MediaMessage {
  mediaUrl: string;
  thumbnailUrl: string;
  type: 'image' | 'video' | 'pdf';
  originalFilename: string;
  conversationId: string;
}

// Thumbnail viewer component that decrypts thumbnails
function ThumbnailViewer({ thumbnailUrl, conversationId, conversationKey, originalFilename, onClick }: {
  thumbnailUrl: string
  conversationId: string
  conversationKey: Uint8Array
  originalFilename?: string
  onClick: () => void
}) {
  const [thumbnailBlob, setThumbnailBlob] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    setLoading(true)
    setError(null)
    setThumbnailBlob(null)

    async function fetchAndDecryptThumbnail() {
      try {
        await sodium.ready
        const res = await fetch(`/api/media/download?conversationId=${conversationId}&filename=${encodeURIComponent(thumbnailUrl.split('/').pop()!)}`)
        if (!res.ok) {
          throw new Error('Failed to fetch thumbnail')
        }
        const encrypted = new Uint8Array(await res.arrayBuffer())
        console.log('ThumbnailViewer: encrypted length', encrypted.length)
        const nonce = encrypted.slice(0, sodium.crypto_secretbox_NONCEBYTES)
        const ciphertext = encrypted.slice(sodium.crypto_secretbox_NONCEBYTES)
        console.log('ThumbnailViewer: nonce', nonce)
        console.log('ThumbnailViewer: ciphertext length', ciphertext.length)
        const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, conversationKey)
        if (!decrypted) {
          console.error('ThumbnailViewer: Decryption failed')
          throw new Error('Thumbnail decryption failed')
        }
        console.log('ThumbnailViewer: decrypted length', decrypted.length)
        console.log('ThumbnailViewer: decrypted first 16 bytes', Array.from(decrypted.slice(0, 16)))
        const blob = new Blob([decrypted], { type: 'image/jpeg' })
        url = URL.createObjectURL(blob)
        setThumbnailBlob(url)
        setLoading(false)
      } catch (err) {
        console.error('ThumbnailViewer error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load thumbnail')
        setLoading(false)
      }
    }

    fetchAndDecryptThumbnail()
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [thumbnailUrl, conversationId, conversationKey])

  if (loading) {
    return (
      <div className="w-32 h-32 bg-gray-100 rounded border border-gray-200 mt-2 flex items-center justify-center">
        <div className="text-gray-400 text-xs">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-32 h-32 bg-gray-100 rounded border border-gray-200 mt-2 flex items-center justify-center">
        <div className="text-red-400 text-xs">Error</div>
      </div>
    )
  }

  return (
    <img
      src={thumbnailBlob!}
      alt={originalFilename || 'media'}
      className="w-32 h-32 object-cover rounded cursor-pointer border border-gray-200 mt-2"
      onClick={onClick}
    />
  )
}

export default function ChatInterface({ conversationId, currentUserEmail, refreshConversations }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [conversation, setConversation] = useState<any>(null)
  const [editingName, setEditingName] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [removeLoading, setRemoveLoading] = useState<string | null>(null)
  const [addressBook, setAddressBook] = useState<any[]>([])
  const [addressBookLoading, setAddressBookLoading] = useState(true)
  const [selectedUsers, setSelectedUsers] = useState<any[]>([])
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false)
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; progress: number; error?: string }[]>([])
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB
  const ALLOWED_TYPES = [
    'image/jpeg', 'image/png',
    'video/mp4', 'video/avi', 'video/quicktime', 'video/mov',
    'application/pdf'
  ]

  // Placeholder: use a static 32-byte key for now (should fetch real key per conversation)
  const conversationKey = new Uint8Array(Array(32).fill(1))

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/messages?conversationId=${conversationId}`)
        if (response.ok) {
          const data = await response.json()
          setMessages(data)
        }
      } catch (error) {
        console.error('Error fetching messages:', error)
      } finally {
        setLoading(false)
      }
    }
    const fetchConversation = async () => {
      try {
        const response = await fetch(`/api/conversations`)
        if (response.ok) {
          const data = await response.json()
          const found = data.find((c: any) => c.id === conversationId)
          setConversation(found)
        }
      } catch (error) {
        console.error('Error fetching conversation:', error)
      }
    }
    if (conversationId) {
      fetchMessages()
      fetchConversation()
    }
  }, [conversationId])

  useEffect(() => {
    // Only fetch address book for group conversations
    if (conversation && conversation.isGroup) {
      setAddressBookLoading(true)
      fetch('/api/users/all')
        .then(res => res.json())
        .then(data => setAddressBook(data))
        .catch(() => setAddressBook([]))
        .finally(() => setAddressBookLoading(false))
    }
  }, [conversation && conversation.isGroup])

  // Helper to get unique, trimmed emails from both sources
  function getCombinedEmails(addEmail: string, selectedUsers: any[]) {
    const manual = addEmail.split(',').map(e => e.trim()).filter(Boolean)
    const selected = selectedUsers.map(u => u.email)
    return Array.from(new Set([...manual, ...selected]))
  }

  // Sync addEmail field with selected users
  useEffect(() => {
    const combined = getCombinedEmails(addEmail, selectedUsers)
    if (combined.join(',') !== addEmail.split(',').map(e => e.trim()).filter(Boolean).join(',')) {
      setAddEmail(combined.join(', '))
    }
    // eslint-disable-next-line
  }, [selectedUsers])

  // When addEmail field changes, update selectedUsers
  useEffect(() => {
    const emails = addEmail.split(',').map(e => e.trim()).filter(Boolean)
    setSelectedUsers(addressBook.filter(u => emails.includes(u.email)))
    // eslint-disable-next-line
  }, [addEmail, addressBook])

  function toggleUser(user: any) {
    if (selectedUsers.some(u => u.email === user.email)) {
      setSelectedUsers(selectedUsers.filter(u => u.email !== user.email))
    } else {
      setSelectedUsers([...selectedUsers, user])
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      // For now, just send the message as plain text
      // In a real implementation, this would be encrypted
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          ciphertext: newMessage, // This should be encrypted
          type: 'text'
        })
      })

      if (response.ok) {
        const message = await response.json()
        setMessages(prev => [...prev, message])
        setNewMessage('')
      }
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files))
    }
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files))
      e.target.value = '' // reset input
    }
  }

  // Utility: generate image thumbnail (200x200, fit inside, JPEG)
  async function generateImageThumbnail(file: File) {
    return new Promise<Blob>((resolve, reject) => {
      const img = new window.Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        const scale = Math.min(200 / img.width, 200 / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create thumbnail blob'));
        }, 'image/jpeg', 0.8);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // Utility: generate PDF thumbnail (first page, 200px wide, JPEG)
  async function generatePdfThumbnail(file: File) {
    try {
      const pdfjsLib = await import('pdfjs-dist/build/pdf');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const scale = 200 / viewport.width;
      const scaledViewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create PDF thumbnail blob'));
        }, 'image/jpeg', 0.8);
      });
    } catch (err) {
      console.error('generatePdfThumbnail error:', err);
      throw err;
    }
  }

  async function encryptFileBuffer(buffer: ArrayBuffer, key: Uint8Array, mimeType: string) {
    await sodium.ready
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
    const ciphertext = sodium.crypto_secretbox_easy(new Uint8Array(buffer), nonce, key)
    // Store as: nonce + ciphertext, preserve original MIME type
    return new Blob([nonce, ciphertext], { type: mimeType })
  }

  async function uploadFile(file: File) {
    // Determine type
    const isImage = file.type === 'image/jpeg' || file.type === 'image/png'
    const isPdf = file.type === 'application/pdf'
    const isVideo = file.type.startsWith('video/')
    let uploadBlob: Blob
    let uploadType: string
    let thumbnailBlob: Blob | null = null
    if (isImage || isPdf) {
      // Encrypt client-side
      const buffer = await file.arrayBuffer()
      console.log('ChatInterface: file buffer first 16 bytes before encryption', Array.from(new Uint8Array(buffer).slice(0, 16)))
      uploadBlob = await encryptFileBuffer(buffer, conversationKey, file.type)
      uploadType = isImage ? 'image' : 'pdf'
      // Generate and encrypt thumbnail
      if (isImage) {
        const thumb = await generateImageThumbnail(file)
        const thumbBuffer = await thumb.arrayBuffer()
        thumbnailBlob = await encryptFileBuffer(thumbBuffer, conversationKey, 'image/jpeg')
      } else if (isPdf) {
        const thumb = await generatePdfThumbnail(file)
        const thumbBuffer = await thumb.arrayBuffer()
        thumbnailBlob = await encryptFileBuffer(thumbBuffer, conversationKey, 'image/jpeg')
      }
    } else if (isVideo) {
      // Upload unencrypted
      uploadBlob = file
      uploadType = 'video'
    } else {
      throw new Error('Unsupported file type')
    }

    const formData = new FormData()
    formData.append('conversationId', conversationId)
    formData.append('type', uploadType)
    formData.append('file', uploadBlob, file.name)
    formData.append('originalFilename', file.name)
    if (thumbnailBlob) {
      formData.append('thumbnail', thumbnailBlob, 'thumb.jpg')
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/media/upload')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          console.log('Upload progress event:', { fileName: file.name, loaded: e.loaded, total: e.total })
          setUploadingFiles(prev => {
            // Try to match by name, fallback to first uploading file
            const idx = prev.findIndex(f => f.name === file.name)
            if (idx !== -1) {
              return prev.map((f, i) => i === idx ? { ...f, progress: Math.round((e.loaded / e.total) * 100) } : f)
            } else if (prev.length > 0) {
              return prev.map((f, i) => i === 0 ? { ...f, progress: Math.round((e.loaded / e.total) * 100) } : f)
            } else {
              return prev
            }
          })
        }
      }
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(JSON.parse(xhr.responseText))
        } else {
          setUploadingFiles(prev => prev.map(f => f.name === file.name ? { ...f, error: 'Upload failed' } : f))
          reject(new Error('Upload failed'))
        }
      }
      xhr.onerror = () => {
        setUploadingFiles(prev => prev.map(f => f.name === file.name ? { ...f, error: 'Upload failed' } : f))
        reject(new Error('Upload failed'))
      }
      xhr.send(formData)
    })
  }

  function handleFiles(files: File[]) {
    const newUploads = files.map(file => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return { name: file.name, progress: 0, error: 'Invalid file type' }
      }
      if (file.size > MAX_SIZE) {
        return { name: file.name, progress: 0, error: 'File too large (max 10MB)' }
      }
      // Placeholder: set progress to 0, will update during upload
      return { name: file.name, progress: 0 }
    })
    setUploadingFiles(prev => [...prev, ...newUploads])
    // Start upload for valid files
    files.forEach(async (file) => {
      if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_SIZE) return
      try {
        const res = await uploadFile(file) as MediaUploadResponse
        if (
          res &&
          typeof res.mediaUrl === 'string' &&
          typeof res.thumbnailUrl === 'string' &&
          typeof res.originalFilename === 'string'
        ) {
          let type: 'image' | 'video' | 'pdf' = 'image'
          if (res.mediaUrl.endsWith('.mp4')) type = 'video'
          else if (res.mediaUrl.endsWith('.pdf')) type = 'pdf'
          setMessages(prev => [...prev, {
            id: 'temp-' + Date.now() + Math.random(),
            ciphertext: '',
            createdAt: new Date().toISOString(),
            sender: { id: 'me', email: currentUserEmail },
            type: 'media',
            mediaUrl: res.mediaUrl,
            thumbnailUrl: res.thumbnailUrl,
            originalFilename: res.originalFilename,
            mediaType: type,
            conversationId: conversationId
          }])
        }
        setUploadingFiles(prev => prev.filter(f => f.name !== file.name))
      } catch {
        // Error already handled
      }
    })
  }

  // Determine chat header name
  let chatHeader = 'Conversation';
  let isGroup = false;
  if (conversation) {
    if (conversation.isGroup) {
      isGroup = true;
      chatHeader = conversation.name || 'Unnamed Group';
    } else if (conversation.participants) {
      const other = conversation.participants.find((p: any) => p.user.email !== currentUserEmail)
      if (other) {
        chatHeader = other.user.name || other.user.email
      }
    }
  }

  // Handle group name edit
  const handleEditGroupName = () => {
    setEditingName(true)
    setNewGroupName(conversation?.name || '')
  }
  const handleSaveGroupName = async () => {
    if (!conversation) return
    setSavingName(true)
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName })
      })
      if (res.ok) {
        setConversation({ ...conversation, name: newGroupName })
        setEditingName(false)
        if (refreshConversations) refreshConversations()
      }
    } finally {
      setSavingName(false)
    }
  }
  const handleNameInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSaveGroupName()
    if (e.key === 'Escape') setEditingName(false)
  }

  const handleAddParticipant = async () => {
    if ((!addEmail.trim() && selectedUsers.length === 0) || !conversation) return
    setAddLoading(true)
    try {
      const emails = getCombinedEmails(addEmail, selectedUsers)
      for (const email of emails) {
        if (!conversation.participants.some((p: any) => p.user.email === email)) {
          await fetch(`/api/conversations/${conversation.id}/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          })
        }
      }
      // Refresh conversation
      if (refreshConversations) refreshConversations()
      setAddEmail('')
      setSelectedUsers([])
      // Refetch conversation details
      const response = await fetch(`/api/conversations`)
      if (response.ok) {
        const data = await response.json()
        const found = data.find((c: any) => c.id === conversation.id)
        setConversation(found)
      }
    } finally {
      setAddLoading(false)
    }
  }
  const handleRemoveParticipant = async (userId: string) => {
    if (!conversation) return
    setRemoveLoading(userId)
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/participants/${userId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        // If removing self, leave group
        if (conversation.participants.find((p: any) => p.user.id === userId)?.user.email === currentUserEmail) {
          if (refreshConversations) refreshConversations()
          setConversation(null)
        } else {
          // Refresh conversation
          if (refreshConversations) refreshConversations()
          // Refetch conversation details
          const response = await fetch(`/api/conversations`)
          if (response.ok) {
            const data = await response.json()
            const found = data.find((c: any) => c.id === conversation.id)
            setConversation(found)
          }
        }
      }
    } finally {
      setRemoveLoading(null)
    }
  }

  // Helper to get all media messages in the conversation
  const mediaMessages: MediaMessage[] = messages
    .map((msg, idx) => ({ ...msg, idx }))
    .filter(msg => msg.type === 'media' && typeof msg.mediaUrl === 'string' && typeof msg.thumbnailUrl === 'string')
    .map(msg => {
      let type: 'image' | 'video' | 'pdf' = 'image'
      if (msg.mediaUrl!.endsWith('.mp4')) type = 'video'
      else if (msg.mediaUrl!.endsWith('.pdf')) type = 'pdf'
      return {
        mediaUrl: msg.mediaUrl!,
        thumbnailUrl: msg.thumbnailUrl!,
        type,
        originalFilename: msg.originalFilename || 'file',
        conversationId: conversationId
      }
    })

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Loading messages...</div>
      </div>
    )
  }

  return (
    <div
      className="flex-1 flex flex-col bg-white"
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
      onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { handleFiles(Array.from(e.dataTransfer.files)); } }}
    >
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-white flex items-center space-x-2">
        {isGroup && editingName ? (
          <input
            className="text-lg font-semibold text-gray-900 border-b border-blue-400 focus:outline-none bg-white px-1"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onBlur={handleSaveGroupName}
            onKeyDown={handleNameInputKey}
            disabled={savingName}
            autoFocus
          />
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900">{chatHeader}</h2>
            {isGroup && (
              <button
                className="ml-2 p-1 text-gray-400 hover:text-blue-600"
                onClick={handleEditGroupName}
                title="Edit group name"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6-6m2 2l-6 6m2 2l-6-6" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
      {/* Manage Participants (Group Only) */}
      {isGroup && conversation && (
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <div className="mb-2 font-semibold text-gray-700">Participants</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {conversation.participants.map((p: any) => (
              <div key={p.user.id} className="flex items-center space-x-2 bg-white border border-gray-200 rounded px-2 py-1">
                <span className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-700">
                  {(p.user.name || p.user.email).charAt(0).toUpperCase()}
                </span>
                <span className="text-sm text-gray-800">{p.user.name || p.user.email}</span>
                <button
                  className="ml-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  onClick={() => handleRemoveParticipant(p.user.id)}
                  disabled={removeLoading === p.user.id}
                  title={p.user.email === currentUserEmail ? 'Leave group' : 'Remove user'}
                >
                  {p.user.email === currentUserEmail ? 'Leave' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
          {/* Address Book for adding users */}
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Address Book</label>
            {addressBookLoading ? (
              <div className="text-gray-400 text-sm mb-2">Loading...</div>
            ) : addressBook.length === 0 ? (
              <div className="text-gray-400 text-sm mb-2">No other users found</div>
            ) : (
              <div className="flex flex-wrap gap-2 mb-2">
                {addressBook.map(user => (
                  <button
                    type="button"
                    key={user.email}
                    onClick={() => toggleUser(user)}
                    className={`flex items-center space-x-2 px-2 py-1 border rounded focus:outline-none ${selectedUsers.some(u => u.email === user.email) ? 'bg-blue-100 border-blue-400' : 'border-gray-300 hover:bg-blue-50'}`}
                  >
                    <span className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-700">
                      {(user.name || user.email || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-800">{user.name || user.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex space-x-2 mt-2">
            <input
              type="text"
              value={addEmail}
              onChange={e => setAddEmail(e.target.value)}
              placeholder="Add user by email (or select above)"
              className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
              disabled={addLoading}
            />
            <button
              onClick={handleAddParticipant}
              disabled={addLoading || (!addEmail.trim() && selectedUsers.length === 0)}
              className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500">
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, i) => (
            <div key={message.id} className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-700">
                    {message.sender.name?.charAt(0) || message.sender.email.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <div className="bg-white rounded-lg px-4 py-2 shadow-sm border">
                  <p className="text-sm text-gray-900">
                    🔒 {message.ciphertext}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </p>
                {message.type === 'media' && message.thumbnailUrl ? (
                  <ThumbnailViewer
                    thumbnailUrl={message.thumbnailUrl}
                    conversationId={conversationId}
                    conversationKey={conversationKey}
                    originalFilename={message.originalFilename}
                    onClick={() => {
                      const idx = mediaMessages.findIndex(m => m.mediaUrl === message.mediaUrl)
                      setMediaViewerIndex(idx)
                      setMediaViewerOpen(true)
                    }}
                  />
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
      {/* Message Input */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative"
      >
        {dragActive && (
          <div className="absolute inset-0 z-40 bg-blue-100 bg-opacity-80 flex items-center justify-center border-2 border-blue-400 border-dashed rounded-lg pointer-events-none">
            <span className="text-blue-700 text-lg font-semibold">Drop files to upload</span>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex space-x-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 bg-gray-100 rounded-lg border border-gray-300 hover:bg-blue-50 focus:outline-none"
            title="Attach file"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a4 4 0 10-5.656-5.656l-6.586 6.586" />
            </svg>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            multiple
            accept="image/jpeg,image/png,video/mp4,video/avi,video/quicktime,video/mov,application/pdf"
            onChange={handleFileInput}
          />
          {uploadingFiles.length > 0 && (
            <div className="mb-2 space-y-1">
              {uploadingFiles.map((file, i) => (
                <div key={i} className="flex items-center space-x-2 text-sm">
                  <span className="font-medium text-gray-700">{file.name}</span>
                  {file.error ? (
                    <span className="text-red-500">{file.error}</span>
                  ) : (
                    <span className="text-blue-600">Uploading... {file.progress}%</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
      {mediaViewerOpen && (
        <MediaViewer
          mediaList={mediaMessages}
          initialIndex={mediaViewerIndex}
          onClose={() => setMediaViewerOpen(false)}
          conversationKey={conversationKey}
        />
      )}
    </div>
  )
}