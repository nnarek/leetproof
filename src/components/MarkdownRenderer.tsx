"use client";

import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const LeanCodeBlock = dynamic(() => import("@/components/LeanCodeBlock"), { ssr: false });

interface MarkdownRendererProps {
  content: string;
}

const katexOptions = { output: "html" } as const;

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content prose prose-invert prose-zinc max-w-none prose-headings:text-zinc-100 prose-p:text-zinc-300 prose-a:text-[#a4b8c5] prose-strong:text-zinc-100 prose-code:rounded prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[#a4b8c5] prose-li:text-zinc-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, katexOptions]]}
        components={{
          pre({ children }) {
            // Extract code content and language from the child <code> element
            const child = children as any;
            if (child?.props?.className) {
              const match = /language-(\w+)/.exec(child.props.className || "");
              const lang = match?.[1];
              const codeStr = String(child.props.children).replace(/\n$/, "");

              if (lang === "lean" || lang === "lean4") {
                return <LeanCodeBlock code={codeStr} />;
              }
            }
            // Default pre for non-lean code blocks
            return <pre>{children}</pre>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
