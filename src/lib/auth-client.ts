"use client";

import { createAuthClient } from "better-auth/react";
import { APP_BASE_PATH } from "@/lib/app-path";

// Same-origin by default so LAN / Tailscale / :3000 all work without
// hardcoding a single NEXT_PUBLIC_APP_URL that may point at nginx.
export const authClient = createAuthClient({
  basePath: `${APP_BASE_PATH}/api/auth`,
});
