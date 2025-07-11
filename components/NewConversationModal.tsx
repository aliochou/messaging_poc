'use client'

import { useState, useEffect } from 'react'

interface NewConversationModalProps {
  onClose: () => void
  onConversationCreated: (conversationId: string) => void
}

export default function NewConversationModal({ onClose, onConversationCreated }: NewConversationModalProps) {
  const [participantEmails, setParticipantEmails] = useState('')
  const [isGroup, setIsGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [loading, setLoading] = useState(false)
  const [addressBook, setAddressBook] = useState<any[]>([])
  const [addressBookLoading, setAddressBookLoading] = useState(true)
  const [selectedUsers, setSelectedUsers] = useState<any[]>([])

  useEffect(() => {
    // Only fetch address book for 1:1 conversations
    if (!isGroup) {
      setAddressBookLoading(true)
      fetch('/api/users/address-book')
        .then(res => res.json())
        .then(data => setAddressBook(data))
        .catch(() => setAddressBook([]))
        .finally(() => setAddressBookLoading(false))
    }
  }, [isGroup])

  // Helper to get unique, trimmed emails from both sources
  function getCombinedEmails(participantEmails: string, selectedUsers: any[]) {
    const manual = participantEmails.split(',').map(e => e.trim()).filter(Boolean)
    const selected = selectedUsers.map(u => u.email)
    return Array.from(new Set([...manual, ...selected]))
  }

  // Sync participantEmails field with selected users
  useEffect(() => {
    const combined = getCombinedEmails(participantEmails, selectedUsers)
    if (combined.join(',') !== participantEmails.split(',').map(e => e.trim()).filter(Boolean).join(',')) {
      setParticipantEmails(combined.join(', '))
    }
    // Auto-check group if 2+ unique emails
    if (combined.length > 1 && !isGroup) setIsGroup(true)
    if (combined.length <= 1 && isGroup) setIsGroup(false)
    // eslint-disable-next-line
  }, [selectedUsers])

  // When participantEmails field changes, update selectedUsers
  useEffect(() => {
    const emails = participantEmails.split(',').map(e => e.trim()).filter(Boolean)
    setSelectedUsers(addressBook.filter(u => emails.includes(u.email)))
    // eslint-disable-next-line
  }, [participantEmails, addressBook])

  // Toggle user selection
  function toggleUser(user: any) {
    if (selectedUsers.some(u => u.email === user.email)) {
      setSelectedUsers(selectedUsers.filter(u => u.email !== user.email))
    } else {
      setSelectedUsers([...selectedUsers, user])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const emails = getCombinedEmails(participantEmails, selectedUsers)
      
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantEmails: emails,
          isGroup,
          name: isGroup ? groupName : undefined
        })
      })

      if (response.ok) {
        const conversation = await response.json()
        onConversationCreated(conversation.id)
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
    } finally {
      setLoading(false)
    }
  }

  // Helper to get user initial
  function getUserInitial(user: any) {
    return (user.name || user.email || '?').charAt(0).toUpperCase();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">New Conversation</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Address Book */}
          {!isGroup && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address Book</label>
              {addressBookLoading ? (
                <div className="text-gray-400 text-sm mb-2">Loading...</div>
              ) : addressBook.length === 0 ? (
                <div className="text-gray-400 text-sm mb-2">No previous 1:1 chats</div>
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
                        {getUserInitial(user)}
                      </span>
                      <span className="text-sm text-gray-800">{user.name || user.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Participant Emails
            </label>
            <input
              type="text"
              value={participantEmails}
              onChange={(e) => setParticipantEmails(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
              required
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isGroup"
              checked={isGroup}
              onChange={(e) => setIsGroup(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isGroup" className="ml-2 block text-sm text-gray-900">
              Group conversation
            </label>
          </div>

          {isGroup && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name (optional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
              />
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 