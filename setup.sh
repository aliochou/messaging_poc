#!/bin/bash

echo "🚀 Setting up Secure Messaging POC..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

# Create .env.local from example if it doesn't exist
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from example..."
    cp env.example .env.local
    echo "✅ Created .env.local - please edit it with your configuration"
else
    echo "✅ .env.local already exists"
fi

# Generate Prisma client
echo "🗄️ Setting up database..."
npm run db:generate

# Push database schema
echo "📊 Creating database tables..."
npm run db:push

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your configuration"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "For Google OAuth (optional):"
echo "1. Go to https://console.cloud.google.com"
echo "2. Create a new project or select existing one"
echo "3. Enable Google+ API"
echo "4. Create OAuth 2.0 credentials"
echo "5. Add http://localhost:3000 to authorized origins"
echo "6. Add http://localhost:3000/api/auth/callback/google to authorized redirect URIs"
echo "7. Copy Client ID and Client Secret to .env.local"
echo ""
echo "Happy messaging! 🔐" 