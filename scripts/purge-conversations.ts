import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

async function purgeConversations() {
  console.log('🧹 Purging all conversations and related data...')
  await prisma.message.deleteMany()
  await prisma.conversationKey.deleteMany()
  await prisma.conversationParticipant.deleteMany()
  await prisma.conversation.deleteMany()
  console.log('✅ All conversations and related data purged.')
}

purgeConversations()
  .catch((e) => {
    console.error('❌ Error purging conversations:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 