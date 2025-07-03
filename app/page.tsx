import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import LoginPage from "@/components/LoginPage"
import MessagingApp from "@/components/MessagingApp"
import { redirect } from "next/navigation"

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return <LoginPage />
  }

  // Check if user has encryption keys
  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { publicKey: true, encryptedPrivateKey: true }
  });

  if (!user?.publicKey || !user?.encryptedPrivateKey) {
    console.log("User doesn't have keys, redirecting to setup-keys");
    redirect('/setup-keys');
  }

  return <MessagingApp />
} 