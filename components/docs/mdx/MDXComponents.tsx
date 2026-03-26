// components/docs/mdx/MDXComponents.tsx — Alle MDX-Komponenten gebündelt

import type { MDXComponents } from "mdx/types";
import { Callout } from "./Callout";
import { CopyButton } from "./CopyButton";

// Pre + Code: Wrapper mit Copy-Button
function Pre({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  // Code-Text aus children extrahieren für Copy-Button
  const codeText =
    typeof children === "object" &&
    children !== null &&
    "props" in (children as React.ReactElement<{ children?: unknown }>)
      ? String((children as React.ReactElement<{ children?: unknown }>).props?.children ?? "")
      : String(children ?? "");

  return (
    <div className="relative group my-5">
      <pre
        {...props}
        className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm leading-relaxed"
      >
        {children}
      </pre>
      <CopyButton code={codeText.trim()} />
    </div>
  );
}

// Inline code
function InlineCode({ children }: { children?: React.ReactNode }) {
  return (
    <code className="rounded px-1.5 py-0.5 bg-zinc-800 text-zinc-200 font-mono text-[0.85em] border border-zinc-700/50">
      {children}
    </code>
  );
}

export function getMDXComponents(): MDXComponents {
  return {
    // Custom components
    Callout,

    // Headings
    h1: ({ children }) => (
      <h1 className="mt-0 mb-4 text-2xl font-bold text-white tracking-tight">{children}</h1>
    ),
    h2: ({ children, id }) => (
      <h2 id={id} className="mt-10 mb-3 text-lg font-semibold text-white scroll-mt-20 border-b border-zinc-800 pb-2">
        {children}
      </h2>
    ),
    h3: ({ children, id }) => (
      <h3 id={id} className="mt-7 mb-2 text-base font-semibold text-zinc-100 scroll-mt-20">
        {children}
      </h3>
    ),
    h4: ({ children, id }) => (
      <h4 id={id} className="mt-5 mb-1.5 text-sm font-semibold text-zinc-200 scroll-mt-20">
        {children}
      </h4>
    ),

    // Text
    p: ({ children }) => (
      <p className="my-4 text-sm leading-7 text-zinc-300">{children}</p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-zinc-100">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-zinc-300">{children}</em>
    ),

    // Lists
    ul: ({ children }) => (
      <ul className="my-4 ml-4 space-y-1.5 list-disc list-outside text-sm text-zinc-300 marker:text-zinc-600">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-4 ml-4 space-y-1.5 list-decimal list-outside text-sm text-zinc-300">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-7 pl-1">{children}</li>
    ),

    // Code
    pre: Pre,
    code: ({ children, className }) => {
      // Inline code (kein className) vs. code block (hat language class)
      if (!className) return <InlineCode>{children}</InlineCode>;
      return <code className={className}>{children}</code>;
    },

    // Blockquote
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-2 border-indigo-500 pl-4 text-sm text-zinc-400 italic">
        {children}
      </blockquote>
    ),

    // Links
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
        target={href?.startsWith("http") ? "_blank" : undefined}
        rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    ),

    // HR
    hr: () => <hr className="my-8 border-zinc-800" />,

    // Table
    table: ({ children }) => (
      <div className="my-5 overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm text-zinc-300">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-zinc-900 text-xs text-zinc-400 uppercase tracking-wider">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-zinc-800 bg-zinc-950">{children}</tbody>
    ),
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => (
      <th className="px-4 py-3 text-left font-medium">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 align-top">{children}</td>
    ),
  };
}
