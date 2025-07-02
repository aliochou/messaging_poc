import NextAuth, { type NextAuthOptions, type SessionStrategy } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  callbacks: {
    async session({ session, token, user }) {
      if (session.user) {
        session.user.id = user?.id || token?.sub || session.user.id;
      }
      return session;
    },
    async signIn({ user, account, profile }: { user: any; account: any; profile?: any }) {
      // Check if user exists and has encryption keys
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email! },
      })

      if (!existingUser) {
        // New user - they'll need to generate keys on the client
        return true
      }

      // Existing user - check if they have encryption keys
      if (!existingUser.publicKey || !existingUser.encryptedPrivateKey) {
        // User exists but doesn't have keys - redirect to key generation
        return "/setup-keys"
      }

      return true
    },
  },
  session: {
    strategy: "jwt" as SessionStrategy,
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST } 