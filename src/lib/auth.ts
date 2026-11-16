import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 Jam sesuai PRD FR-1 & AC
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Username atau Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("Username/email dan password wajib diisi");
        }

        const identifier = credentials.identifier.trim().toLowerCase();

        // Cari user berdasarkan email atau username
        const user = await db.user.findFirst({
          where: {
            OR: [
              { email: { equals: identifier, mode: "insensitive" } },
              { username: { equals: identifier, mode: "insensitive" } },
            ],
          },
          include: {
            member: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (!user) {
          throw new Error("Kredensial tidak valid");
        }

        if (!user.isActive) {
          throw new Error("Akun Anda telah dinonaktifkan. Hubungi admin.");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          throw new Error("Kredensial tidak valid");
        }

        // Catat audit login sukses (non-blocking)
        db.auditLog
          .create({
            data: {
              userId: user.id,
              action: "LOGIN",
              entity: "User",
              entityId: user.id,
              detailJson: {
                role: user.role,
                timestamp: new Date().toISOString(),
              },
            },
          })
          .catch((err) => console.error("Gagal mencatat audit login:", err));

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          memberId: user.memberId,
          name: user.member?.name || user.username,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.email = user.email;
        token.role = user.role;
        token.memberId = user.memberId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.email = token.email;
        session.user.role = token.role;
        session.user.memberId = token.memberId;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "koperasi_default_secret_for_build",
};

/**
 * Server-side helper untuk mendapatkan sesi user saat ini.
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

/**
 * Server-side helper untuk memastikan user sudah login.
 * Melempar error atau mengembalikan user session.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Anda harus login terlebih dahulu.");
  }
  return user;
}

/**
 * Server-side helper untuk otorisasi berdasarkan role (RBAC).
 * Jika role tidak cocok, melempar error FORBIDDEN.
 */
export async function requireRole(allowedRoles: Role | Role[]) {
  const user = await requireAuth();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(user.role)) {
    throw new Error("FORBIDDEN: Anda tidak memiliki izin untuk tindakan ini.");
  }

  return user;
}
