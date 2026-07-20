"use client";

import { createAuthClient } from "better-auth/react";

// Same-origin by default so LAN / Tailscale / :3000 all work without
// hardcoding a single NEXT_PUBLIC_APP_URL that may point at nginx.
export const authClient = createAuthClient();
