"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SetupKeysClientProps {
  session: any;
}

export default function SetupKeysClient({ session }: SetupKeysClientProps) {
  const router = useRouter();
  const [setupStatus, setSetupStatus] = useState("Starting setup...");

  useEffect(() => {
    console.log("SetupKeysClient useEffect triggered", { 
      session: !!session, 
      email: session?.user?.email
    });

    const setupKeys = async () => {
      try {
        console.log("Starting key setup process...");
        setSetupStatus("Generating encryption keys...");
        
        // Import crypto functions
        console.log("Importing crypto functions...");
        const { generateKeyPair, encryptPrivateKey } = await import('@/lib/crypto');
        console.log("Crypto functions imported successfully");
        
        // Generate new key pair
        console.log("Generating key pair...");
        const keypair = await generateKeyPair();
        console.log("Key pair generated successfully");
        
        setSetupStatus("Encrypting private key...");
        
        // Encrypt private key with user's email as password
        console.log("Encrypting private key...");
        const password = session.user?.email || '';
        const encryptedPrivateKey = await encryptPrivateKey(keypair.privateKey, password);
        console.log("Private key encrypted successfully");
        
        setSetupStatus("Uploading keys to server...");
        
        // Upload keys to server
        console.log("Uploading keys to server...");
        const response = await fetch('/api/users/setup-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicKey: keypair.publicKey,
            encryptedPrivateKey
          })
        });

        console.log("Server response:", response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Server error response:", errorText);
          throw new Error(`Failed to upload keys: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log("Server response data:", result);

        setSetupStatus("Setting up local storage...");
        
        // Store keys in localStorage for client-side use
        console.log("Storing keys in localStorage...");
        const userEmail = session.user?.email || '';
        localStorage.setItem(`privateKey_${userEmail}`, keypair.privateKey);
        localStorage.setItem(`publicKey_${userEmail}`, keypair.publicKey);
        console.log("Keys stored in localStorage successfully");
        
        setSetupStatus("Setup complete! Redirecting...");
        
        // Redirect to main app after a brief delay
        setTimeout(() => {
          console.log("Redirecting to main app...");
          router.push('/');
        }, 1000);
        
      } catch (error) {
        console.error('Key setup error:', error);
        setSetupStatus(`Error: ${error instanceof Error ? error.message : 'Failed to set up keys. Please try again.'}`);
      }
    };

    setupKeys();
  }, [session?.user?.email, router]);

  const handleManualSetup = () => {
    if (session?.user?.email) {
      setSetupStatus("Manually starting setup...");
      // Force re-run the setup
      const setupKeys = async () => {
        try {
          console.log("Manual setup triggered...");
          setSetupStatus("Generating encryption keys...");
          
          const { generateKeyPair, encryptPrivateKey } = await import('@/lib/crypto');
          const keypair = await generateKeyPair();
          
          setSetupStatus("Encrypting private key...");
          const password = session.user?.email || '';
          const encryptedPrivateKey = await encryptPrivateKey(keypair.privateKey, password);
          
          setSetupStatus("Uploading keys to server...");
          const response = await fetch('/api/users/setup-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              publicKey: keypair.publicKey,
              encryptedPrivateKey
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to upload keys: ${response.status} ${response.statusText}`);
          }

          setSetupStatus("Setting up local storage...");
          const userEmail = session.user?.email || '';
          localStorage.setItem(`privateKey_${userEmail}`, keypair.privateKey);
          localStorage.setItem(`publicKey_${userEmail}`, keypair.publicKey);
          
          setSetupStatus("Setup complete! Redirecting...");
          setTimeout(() => {
            router.push('/');
          }, 1000);
          
        } catch (error) {
          console.error('Manual setup error:', error);
          setSetupStatus(`Error: ${error instanceof Error ? error.message : 'Failed to set up keys.'}`);
        }
      };
      setupKeys();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900 mb-6"></div>
      <h1 className="text-2xl font-bold mb-4">Setting Up Your Secure Keys…</h1>
      <p className="text-center max-w-md mb-4">{setupStatus}</p>
      <p className="text-center max-w-md text-sm text-gray-600 mb-4">
        Please wait while we securely generate and store your encryption keys. 
        This only happens once and is fully automatic.
      </p>
      
      {/* Debug info */}
      <div className="text-xs text-gray-500 mb-4">
        <p>Email: {session?.user?.email || 'None'}</p>
      </div>
      
      {/* Manual setup button */}
      {session?.user?.email && (
        <button 
          onClick={handleManualSetup}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Manual Setup
        </button>
      )}
    </div>
  );
} 