import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
  admin,
  anonymous,
  username,
  jwt,
  lastLoginMethod,
} from "better-auth/plugins";
import prisma from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [username(), anonymous(), admin(), jwt(), lastLoginMethod()],
  trustedOrigins: ["http://localhost:3001"],
});
