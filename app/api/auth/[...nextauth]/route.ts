import NextAuth, { type NextAuthOptions, type SessionStrategy } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

// Extend the session type to include id
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    }
  }
}

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
      console.log("Session callback called", { session, token, user });
      
      if (session.user) {
        // For JWT strategy, use token.sub as the user ID
        session.user.id = user?.id || token?.sub || session.user.id;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      console.log("JWT callback called", { token, user, account });
      
      // If user is provided, this is the initial sign in
      if (user) {
        token.sub = user.id;
      }
      
      return token;
    },
    async signIn({ user, account, profile }: { user: any; account: any; profile?: any }) {
      console.log("SignIn callback called", { user, account });
      
      // Always allow sign in - we'll handle key setup logic elsewhere
      console.log("Allowing sign in for user:", user.email);
      return true;
    },
  },
  session: {
    strategy: "jwt" as SessionStrategy,
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST } 