/** Production base path (e.g. /simosnai). Empty in local dev. */
export const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix an app-relative path with the production base path. */
export function appPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE_PATH}${p}`;
}
