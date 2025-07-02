# Secure Messaging POC

A browser-based, end-to-end encrypted messaging proof-of-concept built with Next.js, Prisma, and NextAuth.

## Features

- 🔐 **End-to-End Encryption**: Messages are encrypted client-side using Libsodium
- 👤 **Authentication**: Email and Google SSO via NextAuth.js
- 💬 **Conversations**: 1:1 and group chats with symmetric encryption per conversation
- 🔑 **Key Management**: Automatic key generation and secure storage
- 📱 **Modern UI**: Clean, responsive interface built with Tailwind CSS
- 🗄️ **SQLite Database**: Local development with Prisma ORM
- 🚀 **Vercel Ready**: Easy deployment to Vercel

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite with Prisma ORM
- **Authentication**: NextAuth.js (Email + Google)
- **Encryption**: Libsodium.js (WebCrypto API wrapper)
- **Deployment**: Vercel (optional)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd messaging_poc
npm install
```

### 2. Environment Setup

Copy the example environment file and configure it:

```bash
cp env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

### Data Model

- **User**: id, email, username, public_key, encrypted_private_key
- **Conversation**: id, is_group, name, created_by
- **ConversationParticipant**: user_id, conversation_id, role
- **ConversationKey**: conversation_id, user_id, encrypted_symmetric_key
- **Message**: id, conversation_id, sender_id, type, ciphertext, created_at, status

### E2EE Flow

1. **User Registration**: Generate keypair in browser, upload public key and encrypted private key
2. **Conversation Creation**: Generate AES-256 key, encrypt it per participant's public key
3. **Message Sending**: Encrypt with AES-256-GCM, upload ciphertext only
4. **Message Receiving**: Decrypt symmetric key using private key, then decrypt message

### Security Features

- Private keys stored client-side, encrypted with password-derived key
- Symmetric keys per conversation, encrypted with each participant's public key
- Messages encrypted with AES-256-GCM
- No server-side message decryption
- Account reconciliation for SSO/email users

## API Endpoints

### Authentication
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out

### Users
- `POST /api/users/setup-keys` - Setup encryption keys

### Conversations
- `GET /api/conversations` - List user's conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/[id]/keys` - Get conversation key
- `POST /api/conversations/[id]/keys` - Set conversation key

### Messages
- `GET /api/messages?conversationId=...` - Get conversation messages
- `POST /api/messages` - Send new message

## Usage

### First Time Setup

1. Sign in with Google or email
2. Generate encryption keys (automatic on first login)
3. Start creating conversations

### Creating Conversations

1. Click the "+" button in the sidebar
2. Enter participant email addresses
3. Choose between 1:1 or group chat
4. For group chats, provide a name

### Sending Messages

1. Select a conversation from the sidebar
2. Type your message in the input field
3. Press Enter or click Send
4. Messages are automatically encrypted before sending

### Adding Participants

1. In a group conversation, click the participants list
2. Click "Add Participant"
3. Enter the email address
4. The new participant will receive an encrypted conversation key

## Development

### Project Structure

```
messaging_poc/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
├── lib/                   # Utilities and configurations
│   ├── crypto.ts          # Encryption utilities
│   └── prisma.ts          # Database client
├── prisma/                # Database schema
└── public/                # Static assets
```

### Key Components

- `MessagingApp`: Main application component
- `ConversationList`: Sidebar conversation list
- `ChatInterface`: Message display and input
- `NewConversationModal`: Create new conversations
- `LoginPage`: Authentication interface

### Adding Features

1. **New Message Types**: Extend the Message model and add UI components
2. **File Sharing**: Implement encrypted file upload/download
3. **Message Reactions**: Add reaction system with encrypted metadata
4. **Typing Indicators**: Real-time typing status (requires WebSocket)

## Deployment

### Vercel Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Production

```env
DATABASE_URL="your-production-database-url"
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="your-production-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

## Security Considerations

⚠️ **This is a proof-of-concept and not production-ready**

- No forward secrecy implementation
- Private keys stored in localStorage (vulnerable to XSS)
- No message verification or integrity checks
- No rate limiting or abuse prevention
- No audit logging
- No backup/recovery mechanisms

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [Libsodium.js](https://github.com/jedisct1/libsodium.js) for encryption
- [NextAuth.js](https://next-auth.js.org/) for authentication
- [Prisma](https://www.prisma.io/) for database management
- [Tailwind CSS](https://tailwindcss.com/) for styling 