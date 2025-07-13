'use client'

import { useState, useEffect, useRef } from 'react'

interface Conversation {
  id: string
  name?: string
  isGroup: boolean
  participants: Array<{
    user: {
      id: string
      name?: string
      email: string
      image?: string
    }
  }>
  messages: Array<{
    id: string
    ciphertext: string
    createdAt: string
  }>
}

interface ConversationListProps {
  selectedConversation: string | null
  onSelectConversation: (conversationId: string) => void
  currentUserEmail: string
  refreshTrigger?: any
}

export default function ConversationList({ selectedConversation, onSelectConversation, currentUserEmail, refreshTrigger }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState<{ [id: string]: boolean }>({})
  const prevMessagesRef = useRef<{ [id: string]: string }>({})
  const lastSeenMessageIdRef = useRef<{ [id: string]: string }>({})

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await fetch('/api/conversations')
        if (response.ok) {
          const data = await response.json()
          setConversations(data)
        }
      } catch (error) {
        console.error('Error fetching conversations:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchConversations()
  }, [refreshTrigger])

  // Real-time conversation updates using SSE
  useEffect(() => {
    const eventSource = new EventSource('/api/conversations/stream')
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'conversations') {
          // Copy previous message IDs
          const prevMessages = { ...prevMessagesRef.current }
          const lastSeen = { ...lastSeenMessageIdRef.current }
          const newUnread: { [id: string]: boolean } = { ...unread }
          data.data.forEach((conv: Conversation) => {
            const lastMsgId = conv.messages[0]?.id
            if (!lastMsgId) return
            // Only set unread if the latest message is different from last seen
            if (
              lastSeen[conv.id] &&
              lastSeen[conv.id] !== lastMsgId
            ) {
              newUnread[conv.id] = true
            }
            // If conversation is new and not selected, mark as unread
            if (!lastSeen[conv.id] && conv.id !== selectedConversation) {
              newUnread[conv.id] = true
            }
            // If user has seen this message, clear unread
            if (lastSeen[conv.id] === lastMsgId) {
              newUnread[conv.id] = false
            }
          })
          setUnread(prev => ({ ...prev, ...newUnread }))
          setConversations(data.data)
          // Update prevMessagesRef with latest message IDs
          const latestMessages: { [id: string]: string } = {}
          data.data.forEach((conv: Conversation) => {
            const lastMsgId = conv.messages[0]?.id
            if (lastMsgId) latestMessages[conv.id] = lastMsgId
          })
          prevMessagesRef.current = latestMessages
        } else if (data.type === 'connected') {
          console.log('Conversation SSE connected')
        } else if (data.type === 'error') {
          console.error('Conversation SSE error:', data.error)
        }
      } catch (error) {
        console.error('Error parsing conversation SSE message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('Conversation SSE connection error:', error)
      eventSource.close()
    }

    // Cleanup on unmount
    return () => {
      eventSource.close()
    }
  }, [selectedConversation])

  // Debug: log unread state and selectedConversation in render
  console.log('Render: unread state', unread, 'selectedConversation', selectedConversation);

  const handleSelectConversation = (conversationId: string) => {
    // When user clicks, update last seen message ID for that conversation
    const conv = conversations.find(c => c.id === conversationId)
    if (conv && conv.messages.length > 0) {
      lastSeenMessageIdRef.current[conversationId] = conv.messages[0].id
    }
    setUnread(prev => ({ ...prev, [conversationId]: false }))
    onSelectConversation(conversationId)
  }

  const getConversationName = (conversation: Conversation) => {
    if (conversation.isGroup && conversation.name) {
      return conversation.name
    }
    
    // For 1:1 conversations, show the other participant's name
    const otherParticipants = conversation.participants.filter(p => p.user.email !== currentUserEmail)
    if (otherParticipants.length > 0) {
      return otherParticipants[0].user.name || otherParticipants[0].user.email
    }
    
    return 'Unknown'
  }

  const getLastMessage = (conversation: Conversation) => {
    if (conversation.messages.length === 0) {
      return 'No messages yet'
    }
    const lastMessage = conversation.messages[0]
    // Show a lock icon and the first 32 chars of the ciphertext as a preview
    return `🔒 ${lastMessage.ciphertext.slice(0, 32)}${lastMessage.ciphertext.length > 32 ? '…' : ''}`
  }

  if (loading) {
    return (
      <div className="flex-1 p-4">
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-white border-r border-gray-200">
      {conversations.length === 0 ? (
        <div className="p-4 text-center text-gray-500">
          <p>No conversations yet</p>
          <p className="text-sm">Create a new conversation to get started</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {conversations.map((conversation) => {
            const isUnread = unread[conversation.id]
            const isSelected = selectedConversation === conversation.id
            const baseClass = [
              'p-4',
              'cursor-pointer',
              'transition-colors',
              'duration-100',
              isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : '',
              isUnread ? 'bg-blue-100' : '',
              !isSelected && !isUnread ? 'hover:bg-gray-50' : ''
            ].join(' ')
            return (
              <div
                key={conversation.id}
                className={baseClass}
                onClick={() => handleSelectConversation(conversation.id)}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center relative">
                      <span className={`text-sm font-medium text-gray-700 ${isUnread ? 'font-bold' : ''}`}>
                        {getConversationName(conversation).charAt(0).toUpperCase()}
                      </span>
                      {isUnread && (
                        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white"></span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>
                      {getConversationName(conversation)}
                    </p>
                    <p className={`text-sm truncate ${isUnread ? 'font-bold text-gray-700' : 'text-gray-500'}`}>
                      {getLastMessage(conversation)}
                    </p>
                  </div>
                  {conversation.isGroup && (
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        Group
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
} 