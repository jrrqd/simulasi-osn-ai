/** Interpolate mastery/readiness percent (0–100) from red → warn → green. */
export function masteryFill(percent: number): string {
  const p = Math.max(0, Math.min(100, percent));
  const stops: [number, [number, number, number]][] = [
    [0, [180, 35, 24]], // #b42318
    [50, [161, 92, 7]], // #a15c07
    [100, [15, 110, 86]], // #0f6e56
  ];

  let i = 0;
  while (i < stops.length - 1 && p > stops[i + 1]![0]) i += 1;
  const [p0, c0] = stops[i]!;
  const [p1, c1] = stops[Math.min(i + 1, stops.length - 1)]!;
  if (p0 === p1) return rgb(c0);
  const t = (p - p0) / (p1 - p0);
  return rgb([
    Math.round(c0[0] + (c1[0] - c0[0]) * t),
    Math.round(c0[1] + (c1[1] - c0[1]) * t),
    Math.round(c0[2] + (c1[2] - c0[2]) * t),
  ]);
}

function rgb(c: [number, number, number]) {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
