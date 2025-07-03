import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import SetupKeysClient from "./SetupKeysClient"

export default async function SetupKeysPage() {
  const session = await getServerSession(authOptions)
  
  console.log("Server-side session check:", { 
    hasSession: !!session, 
    email: session?.user?.email 
  });

  if (!session?.user?.email) {
    console.log("No server session, redirecting to home");
    redirect('/')
  }

  return <SetupKeysClient session={session} />
} 