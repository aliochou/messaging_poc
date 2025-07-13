'use client'

import { useState } from 'react'
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
      <div className="w-80 h-full overflow-y-auto bg-white border-r border-gray-200 flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <span className="font-bold text-lg text-gray-900">Messages</span>
          <div className="flex items-center space-x-2">
            <button
              className="px-2 py-1 rounded bg-blue-500 text-white text-sm hover:bg-blue-600"
              onClick={() => setShowNewConversation(true)}
            >
              +
            </button>
            <button
              className="px-2 py-1 rounded bg-gray-500 text-white text-sm hover:bg-gray-600"
              onClick={() => signOut({ callbackUrl: '/' })}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
        <ConversationList
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
          currentUserEmail={session.user?.email || ''}
          refreshTrigger={refreshTrigger}
        />
      </div>
      {/* Main Chat Area */}
      <div className="flex-1 h-full overflow-y-auto flex flex-col">
        {selectedConversation ? (
          <ChatInterface
            conversationId={selectedConversation}
            currentUserEmail={session.user?.email || ''}
            refreshConversations={() => setRefreshTrigger((prev) => prev + 1)}
          />
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