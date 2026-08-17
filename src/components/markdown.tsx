"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

function headingId(children: ReactNode): string {
  const text = flattenText(children);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function flattenText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (typeof node === "object" && node !== null && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return flattenText(props?.children);
  }
  return "";
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-osn">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt ?? ""}
              className="my-3 h-auto max-h-[28rem] w-auto max-w-full rounded-md border border-[var(--line)] object-contain bg-[var(--card)]"
            />
          ),
          h2: ({ children }) => {
            const id = headingId(children);
            return (
              <h2 id={id}>
                <span id={`concept-${id}`} />
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const id = headingId(children);
            return (
              <h3 id={id}>
                <span id={`concept-${id}`} />
                {children}
              </h3>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
