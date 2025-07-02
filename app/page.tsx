import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import LoginPage from '@/components/LoginPage'
import MessagingApp from '@/components/MessagingApp'

export default async function Home() {
  const session = await getServerSession()

  if (!session) {
    return <LoginPage />
  }

  return <MessagingApp />
} 