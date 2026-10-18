/**
 * Strip scriptable / event-handler content from SVG so serving as image/svg+xml
 * cannot execute JS when opened in a new tab.
 */
export function sanitizeSvgMarkup(svg: string): string {
  let out = String(svg ?? "");
  // Remove script / foreignObject / animate* that can run scripts or navigate.
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  // Strip inline event handlers (onload=, onclick=, …)
  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Neutralize javascript: URLs in href / xlink:href
  out = out.replace(
    /(href|xlink:href)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi,
    '$1="#"',
  );
  return out;
}

export const SVG_RESPONSE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox";
