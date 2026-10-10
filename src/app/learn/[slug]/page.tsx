import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SessionBoundary } from "@/components/SessionBoundary";
import { Studio } from "@/components/Studio";
import { TUTORIALS, getTutorial } from "@/tutorials";

export function generateStaticParams() {
  return TUTORIALS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = getTutorial(slug);
  return t ? { title: `${t.title} · Gesture Rack`, description: t.tagline } : {};
}

export default async function TutorialPage({ params }: PageProps<"/learn/[slug]">) {
  const { slug } = await params;
  if (!getTutorial(slug)) notFound();
  // Each lesson, and each visit to it, is its own session: keyed by slug, and reset by
  // SessionBoundary whenever Next.js hides the page on navigation.
  return (
    <SessionBoundary>
      <Studio key={slug} tutorialSlug={slug} />
    </SessionBoundary>
  );
}
