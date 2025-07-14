# 🚀 **LIVE DEPLOYMENT GUIDE**

## 📋 **Prerequisites**

Before starting deployment, ensure you have:
- [ ] GitHub account with repository access
- [ ] Vercel account (free)
- [ ] Supabase account (free)
- [ ] Google Cloud Console access (for OAuth)

---

## 🔧 **Step 1: Supabase Setup**

### **1.1 Create Supabase Project**
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Choose "New project"
4. Fill in:
   - **Name**: `messaging-poc`
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"

### **1.2 Get Database Connection String**
1. Go to **Settings** → **Database**
2. Copy the **Connection string** (URI format)
3. Replace `[YOUR-PASSWORD]` with your database password
4. Save for Step 3

### **1.3 Get API Keys**
1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (SUPABASE_URL)
   - **anon public** (SUPABASE_ANON_KEY)
   - **service_role** (SUPABASE_SERVICE_ROLE_KEY)
3. Save for Step 3

---

## 🔧 **Step 2: Google OAuth Setup**

### **2.1 Create Google Cloud Project**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable **Google+ API**

### **2.2 Configure OAuth Credentials**
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client IDs**
3. Choose **Web application**
4. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain.vercel.app/api/auth/callback/google` (production)
5. Copy **Client ID** and **Client Secret**

---

## 🔧 **Step 3: Environment Configuration**

### **3.1 Create Production Environment File**
```bash
cp env.production.example .env.production
```

### **3.2 Fill in Environment Variables**
Edit `.env.production`:
```env
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"

# Supabase Configuration
SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
SUPABASE_ANON_KEY="YOUR_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"

# NextAuth Configuration
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="GENERATE_A_SECURE_SECRET"

# Google OAuth (Production)
GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"

# Security
NODE_ENV="production"
```

### **3.3 Generate Secure Secret**
```bash
openssl rand -base64 32
```

---

## 🔧 **Step 4: Database Migration**

### **4.1 Update Prisma Schema**
The schema is already updated for PostgreSQL.

### **4.2 Run Migration**
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migration
npx prisma migrate deploy
```

---

## 🔧 **Step 5: Vercel Deployment**

### **5.1 Connect to Vercel**
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### **5.2 Configure Environment Variables**
In Vercel dashboard, go to **Settings** → **Environment Variables**:

| Name | Value | Environment |
|------|-------|-------------|
| `DATABASE_URL` | Your Supabase connection string | Production |
| `SUPABASE_URL` | Your Supabase project URL | Production |
| `SUPABASE_ANON_KEY` | Your Supabase anon key | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key | Production |
| `NEXTAUTH_URL` | `https://your-domain.vercel.app` | Production |
| `NEXTAUTH_SECRET` | Your generated secret | Production |
| `GOOGLE_CLIENT_ID` | Your Google client ID | Production |
| `GOOGLE_CLIENT_SECRET` | Your Google client secret | Production |

### **5.3 Deploy**
1. Click **Deploy**
2. Wait for build to complete
3. Test the application

---

## 🔧 **Step 6: Post-Deployment Setup**

### **6.1 Initialize Storage**
```bash
# Run the deployment setup script
npx tsx scripts/deploy-setup.ts
```

### **6.2 Test Functionality**
1. **Authentication**: Test Google OAuth login
2. **Messaging**: Send test messages
3. **Media Upload**: Upload images, videos, PDFs
4. **Cross-User**: Test with multiple users
5. **Real-time**: Test SSE functionality

### **6.3 Monitor Performance**
- Check Vercel analytics
- Monitor Supabase usage
- Review error logs

---

## 🔧 **Step 7: Custom Domain (Optional)**

### **7.1 Add Custom Domain**
1. In Vercel dashboard, go to **Settings** → **Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` in environment variables

### **7.2 Update Google OAuth**
1. Go to Google Cloud Console
2. Add your custom domain to authorized redirect URIs
3. Update environment variables

---

## 🚨 **Troubleshooting**

### **Common Issues:**

**1. Database Connection Failed**
- Check DATABASE_URL format
- Verify Supabase credentials
- Ensure database is accessible

**2. OAuth Errors**
- Verify redirect URIs match exactly
- Check client ID/secret
- Ensure domain is authorized

**3. File Upload Issues**
- Check Supabase storage permissions
- Verify bucket configuration
- Review file size limits

**4. Build Errors**
- Check Node.js version compatibility
- Review dependency conflicts
- Verify environment variables

---

## 📊 **Cost Monitoring**

### **Free Tier Limits:**
- **Vercel**: 100GB bandwidth, 100 serverless executions/day
- **Supabase**: 500MB database, 50MB file storage, 2GB bandwidth

### **Upgrade When:**
- Exceeding bandwidth limits
- Database storage > 500MB
- File storage > 50MB
- High serverless function usage

---

## 🎉 **Success Checklist**

- [ ] Application deployed to Vercel
- [ ] Database migrated to Supabase
- [ ] File storage configured
- [ ] OAuth working in production
- [ ] Media upload/download working
- [ ] Cross-user functionality tested
- [ ] Real-time messaging working
- [ ] Security measures validated
- [ ] Performance monitoring active

**Congratulations! Your end-to-end encrypted messaging POC is now live! 🚀** 