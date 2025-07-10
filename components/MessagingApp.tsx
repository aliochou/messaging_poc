'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import ConversationList from './ConversationList'
import ChatInterface from './ChatInterface'
import NewConversationModal from './NewConversationModal'

export default function MessagingApp() {
  const { data: session } = useSession()
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  if (!session) {
    return <div>Loading...</div>
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">Messages</h1>
            <button
              onClick={() => setShowNewConversation(true)}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="mt-2 flex items-center">
            <img
              src={session.user?.image || '/default-avatar.png'}
              alt="Profile"
              className="w-8 h-8 rounded-full"
            />
            <span className="ml-2 text-sm text-gray-700">{session.user?.name || session.user?.email}</span>
            <button
              onClick={() => signOut()}
              className="ml-auto p-1 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <ConversationList
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
          currentUserEmail={session.user?.email || ''}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <ChatInterface conversationId={selectedConversation} currentUserEmail={session.user?.email || ''} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No conversation selected</h3>
              <p className="mt-1 text-sm text-gray-500">Choose a conversation from the sidebar to start messaging.</p>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewConversation && (
        <NewConversationModal
          onClose={() => setShowNewConversation(false)}
          onConversationCreated={(conversationId) => {
            setSelectedConversation(conversationId)
            setShowNewConversation(false)
            setRefreshTrigger((prev) => prev + 1)
          }}
        />
      )}
    </div>
  )
} 