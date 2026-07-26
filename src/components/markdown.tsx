"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

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
              className="my-3 h-auto max-h-[28rem] w-auto max-w-full rounded-md border border-[var(--line)] object-contain bg-[var(--panel)]"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
