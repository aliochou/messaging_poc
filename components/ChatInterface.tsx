'use client'

import { useState, useEffect } from 'react'

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
}

interface ChatInterfaceProps {
  conversationId: string
  currentUserEmail: string
}

export default function ChatInterface({ conversationId, currentUserEmail }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [conversation, setConversation] = useState<any>(null)

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

  // Determine chat header name
  let chatHeader = 'Conversation';
  if (conversation) {
    if (conversation.isGroup && conversation.name) {
      chatHeader = conversation.name;
    } else if (conversation.participants) {
      const other = conversation.participants.find((p: any) => p.user.email !== currentUserEmail)
      if (other) {
        chatHeader = other.user.name || other.user.email
      }
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-900">{chatHeader}</h2>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500">
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
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
              </div>
            </div>
          ))
        )}
      </div>
      {/* Message Input */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="flex space-x-4">
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
    </div>
  )
}