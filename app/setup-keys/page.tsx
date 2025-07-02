"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SetupKeysPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [status, setStatus] = useState("Generating encryption keys...");

  useEffect(() => {
    if (!session?.user?.email) return;

    const setupKeys = async () => {
      try {
        setStatus("Generating encryption keys...");
        
        // Import crypto functions
        const { generateKeyPair, encryptPrivateKey } = await import('@/lib/crypto');
        
        // Generate new key pair
        const keypair = await generateKeyPair();
        
        setStatus("Encrypting private key...");
        
        // Encrypt private key with user's email as password
        const password = session.user?.email || '';
        const encryptedPrivateKey = await encryptPrivateKey(keypair.privateKey, password);
        
        setStatus("Uploading keys to server...");
        
        // Upload keys to server
        const response = await fetch('/api/users/setup-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicKey: keypair.publicKey,
            encryptedPrivateKey
          })
        });

        if (!response.ok) {
          throw new Error('Failed to upload keys');
        }

        setStatus("Setting up local storage...");
        
        // Store keys in localStorage for client-side use
        const userEmail = session.user?.email || '';
        localStorage.setItem(`privateKey_${userEmail}`, keypair.privateKey);
        localStorage.setItem(`publicKey_${userEmail}`, keypair.publicKey);
        
        setStatus("Setup complete! Redirecting...");
        
        // Redirect to main app after a brief delay
        setTimeout(() => {
          router.push('/');
        }, 1000);
        
      } catch (error) {
        console.error('Key setup error:', error);
        setStatus("Error: Failed to set up keys. Please try again.");
      }
    };

    setupKeys();
  }, [session?.user?.email, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900 mb-6"></div>
      <h1 className="text-2xl font-bold mb-4">Setting Up Your Secure Keys…</h1>
      <p className="text-center max-w-md mb-4">{status}</p>
      <p className="text-center max-w-md text-sm text-gray-600">
        Please wait while we securely generate and store your encryption keys. 
        This only happens once and is fully automatic.
      </p>
    </div>
  );
} 