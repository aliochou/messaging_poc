import { PrismaClient } from '@prisma/client'
import { initializeStorage } from '../lib/supabase'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.production' })

const prisma = new PrismaClient()

async function deploySetup() {
  console.log('🚀 Starting production deployment setup...')

  try {
    // 1. Test database connection
    console.log('📊 Testing database connection...')
    await prisma.$connect()
    console.log('✅ Database connection successful')

    // 2. Run database migrations
    console.log('🔄 Running database migrations...')
    const { execSync } = require('child_process')
    execSync('npx prisma migrate deploy', { stdio: 'inherit' })
    console.log('✅ Database migrations completed')

    // 3. Generate Prisma client
    console.log('🔧 Generating Prisma client...')
    execSync('npx prisma generate', { stdio: 'inherit' })
    console.log('✅ Prisma client generated')

    // 4. Initialize Supabase storage
    console.log('📦 Initializing Supabase storage...')
    await initializeStorage()
    console.log('✅ Storage buckets initialized')

    // 5. Create test users if needed
    console.log('👥 Setting up test users...')
    await setupTestUsers()

    console.log('\n🎉 Production setup completed successfully!')
    console.log('\n📋 Next steps:')
    console.log('1. Deploy to Vercel')
    console.log('2. Configure environment variables in Vercel dashboard')
    console.log('3. Test the application')
    console.log('4. Set up custom domain (optional)')

  } catch (error) {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

async function setupTestUsers() {
  // Check if test users exist
  const testUsers = await prisma.user.findMany({
    where: {
      email: {
        in: ['alice@test.com', 'bob@test.com', 'charlie@test.com']
      }
    }
  })

  if (testUsers.length === 0) {
    console.log('   Creating test users...')
    // Create test users for demo purposes
    const users = [
      { email: 'alice@test.com', name: 'Alice Test' },
      { email: 'bob@test.com', name: 'Bob Test' },
      { email: 'charlie@test.com', name: 'Charlie Test' }
    ]

    for (const user of users) {
      await prisma.user.create({
        data: {
          email: user.email,
          name: user.name,
          publicKey: 'demo-key-for-testing-only', // Demo only - not for production
          encryptedPrivateKey: 'demo-encrypted-key-for-testing-only'
        }
      })
    }
    console.log('   ✅ Test users created')
  } else {
    console.log('   ✅ Test users already exist')
  }
}

deploySetup() 