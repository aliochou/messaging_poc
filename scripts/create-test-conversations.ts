import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

const testConversations = [
  {
    name: 'Alice & Bob Chat',
    isGroup: false,
    participants: ['alice@test.com', 'bob@test.com']
  },
  {
    name: 'Group Chat',
    isGroup: true,
    participants: ['alice@test.com', 'bob@test.com', 'charlie@test.com']
  },
  {
    name: 'Diana & Eve Chat',
    isGroup: false,
    participants: ['diana@test.com', 'eve@test.com']
  },
  {
    name: 'All Users Group',
    isGroup: true,
    participants: ['alice@test.com', 'bob@test.com', 'charlie@test.com', 'diana@test.com', 'eve@test.com']
  }
]

async function createTestConversations() {
  console.log('💬 Creating test conversations...')

  for (const convData of testConversations) {
    try {
      // Get the first participant as the creator
      const creatorEmail = convData.participants[0]
      const creator = await prisma.user.findUnique({
        where: { email: creatorEmail }
      })

      if (!creator) {
        console.log(`❌ Creator ${creatorEmail} not found, skipping conversation`)
        continue
      }

      // Check if conversation already exists
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          name: convData.name,
          createdById: creator.id
        }
      })

      if (existingConversation) {
        console.log(`✅ Conversation "${convData.name}" already exists, skipping...`)
        continue
      }

      // Create conversation
      const conversation = await prisma.conversation.create({
        data: {
          name: convData.name,
          isGroup: convData.isGroup,
          createdById: creator.id,
          participants: {
            create: convData.participants.map(email => ({
              user: {
                connect: { email }
              },
              role: email === creatorEmail ? 'admin' : 'member'
            }))
          }
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      })

      console.log(`✅ Created conversation: "${conversation.name}"`)
      console.log(`   Participants: ${conversation.participants.map(p => p.user.name).join(', ')}`)
      
    } catch (error) {
      console.error(`❌ Error creating conversation "${convData.name}":`, error)
    }
  }

  console.log('🎉 Test conversation creation complete!')
  console.log('\n📋 Test conversations created:')
  testConversations.forEach(conv => {
    console.log(`   - ${conv.name} (${conv.isGroup ? 'Group' : '1:1'})`)
  })
  console.log('\n💡 You can now test messaging between these users!')
}

async function main() {
  try {
    await createTestConversations()
  } catch (error) {
    console.error('❌ Conversation creation failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { createTestConversations } 