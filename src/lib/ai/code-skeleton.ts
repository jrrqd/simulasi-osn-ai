/** Default markers for locked skeleton regions (OSN AI 2026). */
export const DEFAULT_WRITE_OPEN = "# >>> WRITE HERE <<<";
export const DEFAULT_WRITE_CLOSE = "# <<< END <<<";

export type SkeletonMarkers = { open: string; close: string };

export function resolveMarkers(
  markers?: SkeletonMarkers | null,
): SkeletonMarkers {
  return {
    open: markers?.open?.trim() || DEFAULT_WRITE_OPEN,
    close: markers?.close?.trim() || DEFAULT_WRITE_CLOSE,
  };
}

export type ParsedSkeleton = {
  before: string;
  editable: string;
  after: string;
  markers: SkeletonMarkers;
  ok: boolean;
  error?: string;
};

/** Split skeleton into locked (before/after) and editable middle. */
export function parseSkeleton(
  skeleton: string,
  markers?: SkeletonMarkers | null,
): ParsedSkeleton {
  const m = resolveMarkers(markers);
  const openIdx = skeleton.indexOf(m.open);
  const closeIdx = skeleton.indexOf(m.close, openIdx + m.open.length);

  if (openIdx < 0 || closeIdx < 0) {
    return {
      before: skeleton,
      editable: "",
      after: "",
      markers: m,
      ok: false,
      error: `Skeleton harus berisi marker "${m.open}" dan "${m.close}"`,
    };
  }

  const before = skeleton.slice(0, openIdx + m.open.length);
  const editable = skeleton.slice(openIdx + m.open.length, closeIdx);
  const after = skeleton.slice(closeIdx);

  return { before, editable, after, markers: m, ok: true };
}

/** Rebuild full source from locked parts + student editable region. */
export function assembleCode(
  skeleton: string,
  editable: string,
  markers?: SkeletonMarkers | null,
): { code: string; ok: boolean; error?: string } {
  const parsed = parseSkeleton(skeleton, markers);
  if (!parsed.ok) {
    return { code: skeleton, ok: false, error: parsed.error };
  }
  // Preserve trailing newline conventions inside the editable region
  const middle = editable.endsWith("\n") || editable.length === 0
    ? editable
    : `${editable}\n`;
  // If skeleton had content between markers starting with newline, keep one
  const code = `${parsed.before}${middle.startsWith("\n") || parsed.before.endsWith("\n") ? "" : "\n"}${middle}${parsed.after.startsWith("\n") ? "" : "\n"}${parsed.after}`.replace(
    /\n{3,}/g,
    "\n\n",
  );
  return { code, ok: true };
}

/**
 * Verify locked regions of userCode match skeleton.
 * Only the region between markers may differ.
 */
export function assertSkeletonUnlockedOnly(
  skeleton: string,
  userCode: string,
  markers?: SkeletonMarkers | null,
): { ok: boolean; error?: string } {
  const sk = parseSkeleton(skeleton, markers);
  if (!sk.ok) return { ok: false, error: sk.error };

  const us = parseSkeleton(userCode, markers);
  if (!us.ok) {
    return {
      ok: false,
      error:
        "Skeleton tidak boleh diubah. Marker WRITE HERE / END harus tetap ada.",
    };
  }

  if (normalizeLocked(sk.before) !== normalizeLocked(us.before)) {
    return {
      ok: false,
      error:
        "Skeleton tidak boleh diubah. Hanya bagian di antara marker yang boleh diedit.",
    };
  }
  if (normalizeLocked(sk.after) !== normalizeLocked(us.after)) {
    return {
      ok: false,
      error:
        "Skeleton tidak boleh diubah. Hanya bagian di antara marker yang boleh diedit.",
    };
  }
  return { ok: true };
}

function normalizeLocked(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "");
}

export function skeletonHasMarkers(
  skeleton: string,
  markers?: SkeletonMarkers | null,
): boolean {
  return parseSkeleton(skeleton, markers).ok;
}

/**
 * If skeleton lacks markers but has lockedRanges (1-based inclusive),
 * inject WRITE HERE markers around the complement (editable) region.
 * lockedRanges describe lines that stay locked; editable = gaps between.
 */
export function ensureSkeletonMarkersFromRanges(
  skeleton: string,
  lockedRanges?: [number, number][] | null,
  markers?: SkeletonMarkers | null,
): string {
  const m = resolveMarkers(markers);
  if (parseSkeleton(skeleton, m).ok) return skeleton;
  if (!lockedRanges?.length) return skeleton;

  const lines = skeleton.replace(/\r\n/g, "\n").split("\n");
  const locked = new Set<number>();
  for (const [a, b] of lockedRanges) {
    const start = Math.max(1, Math.min(a, b));
    const end = Math.min(lines.length, Math.max(a, b));
    for (let i = start; i <= end; i++) locked.add(i);
  }

  // Find contiguous editable run (prefer longest unlocked stretch)
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 1; i <= lines.length; i++) {
    if (!locked.has(i)) {
      if (curStart < 0) curStart = i;
      curLen += 1;
    } else {
      if (curLen > bestLen) {
        bestStart = curStart;
        bestLen = curLen;
      }
      curStart = -1;
      curLen = 0;
    }
  }
  if (curLen > bestLen) {
    bestStart = curStart;
    bestLen = curLen;
  }
  if (bestStart < 0 || bestLen === 0) return skeleton;

  const bestEnd = bestStart + bestLen - 1;
  const before = lines.slice(0, bestStart - 1);
  const editable = lines.slice(bestStart - 1, bestEnd);
  const after = lines.slice(bestEnd);

  return [
    ...before,
    m.open,
    ...editable,
    m.close,
    ...after,
  ].join("\n");
}
