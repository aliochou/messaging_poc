'use client'

import { useState, useEffect } from 'react'

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
}

export default function ConversationList({ selectedConversation, onSelectConversation }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

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
  }, [])

  const getConversationName = (conversation: Conversation) => {
    if (conversation.isGroup && conversation.name) {
      return conversation.name
    }
    
    // For 1:1 conversations, show the other participant's name
    const otherParticipants = conversation.participants.filter(p => p.user.email !== 'current-user@example.com')
    if (otherParticipants.length > 0) {
      return otherParticipants[0].user.name || otherParticipants[0].user.email
    }
    
    return 'Unknown'
  }

  const getLastMessage = (conversation: Conversation) => {
    if (conversation.messages.length === 0) {
      return 'No messages yet'
    }
    return '🔒 Encrypted message'
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
    <div className="flex-1 overflow-y-auto">
      {conversations.length === 0 ? (
        <div className="p-4 text-center text-gray-500">
          <p>No conversations yet</p>
          <p className="text-sm">Create a new conversation to get started</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`p-4 cursor-pointer hover:bg-gray-50 ${
                selectedConversation === conversation.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-700">
                      {getConversationName(conversation).charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {getConversationName(conversation)}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
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
          ))}
        </div>
      )}
    </div>
  )
} 