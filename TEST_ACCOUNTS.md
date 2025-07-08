# Test Accounts for Chat Functions

This document describes the test accounts created for testing the messaging POC's chat functions.

## Test Users

The following test users have been created with full encryption keys:

| Email | Name | Username |
|-------|------|----------|
| `alice@test.com` | Alice Test | alice_test |
| `bob@test.com` | Bob Test | bob_test |
| `charlie@test.com` | Charlie Test | charlie_test |
| `diana@test.com` | Diana Test | diana_test |
| `eve@test.com` | Eve Test | eve_test |

## Test Conversations

The following conversations have been created for testing:

### 1:1 Conversations
- **Alice & Bob Chat**: `alice@test.com` ↔ `bob@test.com`
- **Diana & Eve Chat**: `diana@test.com` ↔ `eve@test.com`

### Group Conversations
- **Group Chat**: `alice@test.com`, `bob@test.com`, `charlie@test.com`
- **All Users Group**: All 5 test users

## How to Test

### Option 1: Use Google OAuth (Recommended)
1. Set up Google OAuth credentials in your `.env.local`:
   ```
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   ```

2. Use these test emails with Google accounts:
   - Create Google accounts for: `alice@test.com`, `bob@test.com`, etc.
   - Or use your own Google account and manually add the test emails to conversations

### Option 2: Manual Testing (Current Setup)
Since the app currently only supports Google OAuth, you can test by:

1. **Sign in with your Google account** (e.g., `adebecque@gmail.com`)
2. **Create conversations** with the test email addresses
3. **Test messaging** by adding the test emails as participants

## Testing Scenarios

### Basic Messaging
1. Sign in with your Google account
2. Create a new conversation with `alice@test.com`
3. Send encrypted messages
4. Verify messages are stored encrypted in the database

### Group Chat Testing
1. Create a group conversation with multiple test users
2. Test adding/removing participants
3. Verify group encryption keys are generated per participant

### End-to-End Encryption
1. Check that messages are encrypted before sending
2. Verify only participants can decrypt messages
3. Test key generation and storage

## Database Verification

You can verify the test data using Prisma Studio:

```bash
npm run db:studio
```

This will open a web interface where you can browse:
- Users table: See all test users with their encryption keys
- Conversations table: See created test conversations
- Messages table: See encrypted messages
- Conversation participants: See who's in each conversation

## Recreating Test Data

If you need to recreate the test data:

```bash
# Recreate test users
npm run seed:test-users

# Recreate test conversations
npm run seed:test-conversations
```

## Security Notes

⚠️ **Important**: These test accounts are for development only:
- Private keys are stored in the database (not secure for production)
- Passwords are the same as email addresses (not secure)
- No real authentication is performed for test accounts

For production use, implement proper authentication and key management.

## Troubleshooting

### "User not found" errors
- Ensure test users exist: `npm run seed:test-users`
- Check database connection in `.env.local`

### "Conversation not found" errors
- Ensure conversations exist: `npm run seed:test-conversations`
- Verify user is a participant in the conversation

### Encryption errors
- Check that sodium library is working
- Verify key generation is successful
- Check browser console for crypto errors 