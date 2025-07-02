'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface CryptoState {
  isReady: boolean
  privateKey: string | null
  publicKey: string | null
  error: string | null
}

export function useCrypto() {
  const { data: session } = useSession()
  const [state, setState] = useState<CryptoState>({
    isReady: false,
    privateKey: null,
    publicKey: null,
    error: null
  })

  useEffect(() => {
    if (!session?.user?.email) return

    const initializeCrypto = async () => {
      try {
        // Check if user has keys in localStorage
        const storedPrivateKey = localStorage.getItem(`privateKey_${session.user.email}`)
        const storedPublicKey = localStorage.getItem(`publicKey_${session.user.email}`)

        if (storedPrivateKey && storedPublicKey) {
          setState({
            isReady: true,
            privateKey: storedPrivateKey,
            publicKey: storedPublicKey,
            error: null
          })
          return
        }

        // Generate new keys
        const { generateKeyPair, encryptPrivateKey } = await import('@/lib/crypto')
        const keypair = await generateKeyPair()
        
        // Encrypt private key with a simple password (in production, use user's password)
        const password = session.user.email // Simple example - use actual password in production
        const encryptedPrivateKey = await encryptPrivateKey(keypair.privateKey, password)

        // Store keys
        localStorage.setItem(`privateKey_${session.user.email}`, keypair.privateKey)
        localStorage.setItem(`publicKey_${session.user.email}`, keypair.publicKey)

        // Upload to server
        await fetch('/api/users/setup-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicKey: keypair.publicKey,
            encryptedPrivateKey
          })
        })

        setState({
          isReady: true,
          privateKey: keypair.privateKey,
          publicKey: keypair.publicKey,
          error: null
        })
      } catch (error) {
        console.error('Crypto initialization error:', error)
        setState(prev => ({
          ...prev,
          error: 'Failed to initialize encryption'
        }))
      }
    }

    initializeCrypto()
  }, [session?.user?.email])

  const encryptMessage = async (message: string, symmetricKey: string) => {
    try {
      const { encryptMessage, combineCiphertextAndNonce } = await import('@/lib/crypto')
      const encrypted = await encryptMessage(message, symmetricKey)
      return combineCiphertextAndNonce(encrypted.ciphertext, encrypted.nonce)
    } catch (error) {
      console.error('Encryption error:', error)
      throw new Error('Failed to encrypt message')
    }
  }

  const decryptMessage = async (encryptedMessage: string, symmetricKey: string) => {
    try {
      const { decryptMessage, separateCiphertextAndNonce } = await import('@/lib/crypto')
      const separated = separateCiphertextAndNonce(encryptedMessage)
      return await decryptMessage(separated, symmetricKey)
    } catch (error) {
      console.error('Decryption error:', error)
      throw new Error('Failed to decrypt message')
    }
  }

  const generateSymmetricKey = async () => {
    try {
      const { generateSymmetricKey } = await import('@/lib/crypto')
      return await generateSymmetricKey()
    } catch (error) {
      console.error('Key generation error:', error)
      throw new Error('Failed to generate symmetric key')
    }
  }

  const encryptSymmetricKey = async (symmetricKey: string, recipientPublicKey: string) => {
    try {
      const { encryptSymmetricKey } = await import('@/lib/crypto')
      return await encryptSymmetricKey(symmetricKey, recipientPublicKey)
    } catch (error) {
      console.error('Symmetric key encryption error:', error)
      throw new Error('Failed to encrypt symmetric key')
    }
  }

  const decryptSymmetricKey = async (encryptedSymmetricKey: string) => {
    if (!state.privateKey) {
      throw new Error('Private key not available')
    }

    try {
      const { decryptSymmetricKey } = await import('@/lib/crypto')
      return await decryptSymmetricKey(encryptedSymmetricKey, state.privateKey)
    } catch (error) {
      console.error('Symmetric key decryption error:', error)
      throw new Error('Failed to decrypt symmetric key')
    }
  }

  return {
    ...state,
    encryptMessage,
    decryptMessage,
    generateSymmetricKey,
    encryptSymmetricKey,
    decryptSymmetricKey
  }
} 