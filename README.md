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

---

## 🔒 SECURITY AUDIT - January 11, 2025

### 🚨 CRITICAL VULNERABILITIES

#### 1. **Static Encryption Key (CRITICAL)**
**Location**: `app/api/media/upload/route.ts:20`
```typescript
const SYMMETRIC_KEY = Buffer.from(Array(32).fill(1))
```
**Risk**: All media files are encrypted with the same static key, making them easily decryptable.
**Impact**: Complete compromise of media encryption
**Recommendation**: Generate unique keys per conversation using proper key derivation

#### 2. **Private Key Storage in localStorage (CRITICAL)**
**Location**: `hooks/useCrypto.ts:25-30`
```typescript
localStorage.setItem(`privateKey_${session.user.email}`, keypair.privateKey)
```
**Risk**: XSS attacks can steal private keys from localStorage
**Impact**: Complete compromise of user's encryption keys
**Recommendation**: Use Web Crypto API's secure storage or hardware-backed key storage

#### 3. **Weak Password Derivation (HIGH)**
**Location**: `lib/crypto.ts:35-45`
```typescript
const password = session.user.email // Simple example - use actual password in production
```
**Risk**: Using email as password is extremely weak
**Impact**: Easy brute-force of encrypted private keys
**Recommendation**: Require strong user passwords and use Argon2/scrypt for key derivation

### 🟡 HIGH SEVERITY ISSUES

#### 4. **No Rate Limiting (HIGH)**
**Risk**: Brute force attacks, DoS, resource exhaustion
**Impact**: Service disruption, unauthorized access
**Recommendation**: Implement rate limiting middleware for all API endpoints

#### 5. **Missing Input Validation (HIGH)**
**Risk**: Injection attacks, path traversal, malicious file uploads
**Impact**: Server compromise, data corruption
**Recommendation**: Add comprehensive input validation using libraries like Zod

#### 6. **No CSRF Protection (HIGH)**
**Risk**: Cross-site request forgery attacks
**Impact**: Unauthorized actions on behalf of users
**Recommendation**: Add CSRF tokens to all state-changing requests

#### 7. **Insecure File Upload (HIGH)**
**Risk**: Malicious file uploads, path traversal
**Impact**: Server compromise, data exfiltration
**Recommendation**: Add file content validation and proper sanitization

### 🟢 MEDIUM SEVERITY ISSUES

#### 8. **No Forward Secrecy (MEDIUM)**
**Risk**: Compromised keys expose all historical messages
**Impact**: Long-term privacy compromise
**Recommendation**: Implement Perfect Forward Secrecy (PFS) with ephemeral keys

#### 9. **Missing Message Integrity (MEDIUM)**
**Risk**: Message tampering, replay attacks
**Impact**: Message authenticity compromise
**Recommendation**: Add message signatures using digital signatures

#### 10. **No Audit Logging (MEDIUM)**
**Risk**: Inability to detect security incidents
**Impact**: Delayed incident response
**Recommendation**: Implement comprehensive security event logging

### 📋 IMMEDIATE ACTION ITEMS

#### Priority 1 (Critical - Fix Immediately)
1. **Replace static encryption key** with per-conversation keys
2. **Move private keys** from localStorage to secure storage
3. **Implement proper password** requirements and key derivation
4. **Add rate limiting** to all API endpoints

#### Priority 2 (High - Fix Within 1 Week)
5. **Add comprehensive input validation** to all endpoints
6. **Implement CSRF protection** for all state-changing operations
7. **Add file upload security** with content validation
8. **Implement audit logging** for security events

#### Priority 3 (Medium - Fix Within 1 Month)
9. **Implement forward secrecy** with ephemeral keys
10. **Add message integrity** with digital signatures
11. **Strengthen session management** with proper timeouts
12. **Add security headers** and CSP

### ⚠️ PRODUCTION READINESS CHECKLIST

**Before deploying to production, ensure:**

- [ ] All critical vulnerabilities are fixed
- [ ] Rate limiting is implemented
- [ ] Input validation is comprehensive
- [ ] Security headers are configured
- [ ] Audit logging is in place
- [ ] Penetration testing is completed
- [ ] Security monitoring is implemented
- [ ] Incident response plan is ready

### 📊 RISK ASSESSMENT SUMMARY

| Vulnerability | Severity | Impact | Effort | Priority |
|--------------|----------|--------|--------|----------|
| Static encryption key | Critical | High | Medium | P1 |
| localStorage private keys | Critical | High | High | P1 |
| No rate limiting | High | Medium | Low | P1 |
| Missing input validation | High | High | Medium | P2 |
| No CSRF protection | High | Medium | Medium | P2 |
| Weak password derivation | High | High | Medium | P1 |

**Overall Risk Level: CRITICAL** - This application is not ready for production use without significant security improvements.

### 🔧 SPECIFIC IMPLEMENTATION RECOMMENDATIONS

#### 1. Secure Key Management
```typescript
// Replace static key with proper key derivation
async function deriveConversationKey(conversationId: string, userKey: string) {
  const salt = await getConversationSalt(conversationId)
  return await sodium.crypto_pwhash(
    32,
    conversationId + userKey,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE
  )
}
```

#### 2. Secure Private Key Storage
```typescript
// Use Web Crypto API for secure storage
async function storePrivateKey(key: string, password: string) {
  const encryptedKey = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: generateIV() },
    await deriveKeyFromPassword(password),
    new TextEncoder().encode(key)
  )
  // Store encrypted key securely
}
```

#### 3. Input Validation
```typescript
// Add comprehensive validation
import { z } from 'zod'

const uploadSchema = z.object({
  conversationId: z.string().cuid(),
  type: z.enum(['image', 'video', 'pdf']),
  file: z.instanceof(File),
  originalFilename: z.string().min(1).max(255)
})
```

#### 4. Rate Limiting
```typescript
// Implement rate limiting
import { rateLimit } from 'express-rate-limit'

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
})
```

### 🗓️ SECURITY ROADMAP

#### Phase 1: Critical Fixes (Week 1)
- [ ] Replace static encryption key
- [ ] Implement secure key storage
- [ ] Add rate limiting
- [ ] Implement input validation

#### Phase 2: Security Hardening (Month 1)
- [ ] Add CSRF protection
- [ ] Implement audit logging
- [ ] Add security headers
- [ ] Strengthen session management

#### Phase 3: Advanced Security (Month 2-3)
- [ ] Implement forward secrecy
- [ ] Add message integrity
- [ ] Implement key rotation
- [ ] Add penetration testing

---

**Note**: This security audit was conducted on January 11, 2025. All vulnerabilities identified must be addressed before any production deployment.

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