import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import LoginPage from "@/components/LoginPage"
import MessagingApp from "@/components/MessagingApp"

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return <LoginPage />
  }

  return <MessagingApp />
} 