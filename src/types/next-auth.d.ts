import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      email: string;
      role: Role;
      memberId?: string | null;
      name?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username: string;
    email: string;
    role: Role;
    memberId?: string | null;
    name?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    email: string;
    role: Role;
    memberId?: string | null;
  }
}
