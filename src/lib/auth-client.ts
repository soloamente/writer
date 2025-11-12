import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  anonymousClient,
  usernameClient,
  jwtClient,
  lastLoginMethodClient,
} from "better-auth/client/plugins";

// Get the base URL for the auth client
// This should match the server-side BETTER_AUTH_URL
const baseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

export const { signIn, signUp, signOut, useSession } = createAuthClient({
  baseURL,
  plugins: [
    usernameClient(),
    anonymousClient(),
    adminClient(),
    jwtClient(),
    lastLoginMethodClient(),
  ],
});
