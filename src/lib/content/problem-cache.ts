const PROBLEM_CACHE_PREFIX = "problem:v2:";

export function problemCacheKey(id: string) {
  return `${PROBLEM_CACHE_PREFIX}${id}`;
}
