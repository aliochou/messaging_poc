import { PrismaClient } from '@prisma/client'
import { generateKeyPair, encryptPrivateKey } from '../lib/crypto'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

const testUsers = [
  {
    email: 'alice@test.com',
    name: 'Alice Test',
    username: 'alice_test'
  },
  {
    email: 'bob@test.com', 
    name: 'Bob Test',
    username: 'bob_test'
  },
  {
    email: 'charlie@test.com',
    name: 'Charlie Test', 
    username: 'charlie_test'
  },
  {
    email: 'diana@test.com',
    name: 'Diana Test',
    username: 'diana_test'
  },
  {
    email: 'eve@test.com',
    name: 'Eve Test',
    username: 'eve_test'
  }
]

async function seedTestUsers() {
  console.log('🌱 Seeding test users...')

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      })

      if (existingUser) {
        console.log(`✅ User ${userData.email} already exists, skipping...`)
        continue
      }

      // Generate encryption keys
      console.log(`🔑 Generating keys for ${userData.email}...`)
      const keypair = await generateKeyPair()
      
      // Encrypt private key with email as password
      const encryptedPrivateKey = await encryptPrivateKey(keypair.privateKey, userData.email)

      // Create user with keys
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          username: userData.username,
          publicKey: keypair.publicKey,
          encryptedPrivateKey: encryptedPrivateKey,
          emailVerified: new Date()
        }
      })

      console.log(`✅ Created user: ${user.email} (ID: ${user.id})`)
      
    } catch (error) {
      console.error(`❌ Error creating user ${userData.email}:`, error)
    }
  }

  console.log('🎉 Test user seeding complete!')
  console.log('\n📧 Test accounts created:')
  testUsers.forEach(user => {
    console.log(`   - ${user.email} (${user.name})`)
  })
  console.log('\n💡 You can now use these email addresses to test chat functions!')
}

async function main() {
  try {
    await seedTestUsers()
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { seedTestUsers } 