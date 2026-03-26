// app/docs/[[...slug]]/page.tsx — Dynamische MDX-Seite für alle /docs/** Routen

import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { getDocBySlug, getDocsIndex, getAllDocsMeta } from "@/lib/docs/mdx";
import { getMDXComponents } from "@/components/docs/mdx/MDXComponents";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug?: string[] }>;
}

// Statische Pfade zur Build-Zeit generieren
export async function generateStaticParams() {
  const docs = getAllDocsMeta();
  return docs.map((doc) => ({
    slug: doc.slug ? doc.slug.split("/") : [],
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = slug?.length ? getDocBySlug(slug) : getDocsIndex();
  return {
    title: doc ? `${doc.title} — Traceback Docs` : "Traceback Docs",
    description: doc?.description,
  };
}

const rehypePrettyCodeOptions = {
  theme: "github-dark",
  keepBackground: true,
};

export default async function DocsPage({ params }: Props) {
  const { slug } = await params;
  const doc = slug?.length ? getDocBySlug(slug) : getDocsIndex();

  if (!doc) notFound();

  return (
    <article className="min-w-0">
      {/* Page header */}
      <div className="mb-8 pb-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">{doc.title}</h1>
        {doc.description && (
          <p className="mt-2 text-base text-zinc-400 leading-relaxed">{doc.description}</p>
        )}
      </div>

      {/* MDX Content */}
      <MDXRemote
        source={doc.content}
        components={getMDXComponents()}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [
              [rehypePrettyCode, rehypePrettyCodeOptions],
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: "wrap" }],
            ],
          },
        }}
      />
    </article>
  );
}
