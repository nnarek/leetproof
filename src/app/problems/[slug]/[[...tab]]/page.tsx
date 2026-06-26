import { getServerDatabase } from "@/lib/db/server";
import { Problem } from "@/lib/types";
import { notFound } from "next/navigation";
import Lean4Editor from "@/components/Lean4Editor";
import ResizableProblemLayout from "@/components/ResizableProblemLayout";
import ProblemTabs from "@/components/ProblemTabs";
import type { Metadata } from "next";

// In static-export mode revalidate is ignored (pages are built once).
// In server mode this enables ISR every 60 s.
export const revalidate = 60;

interface ProblemPageProps {
  params: Promise<{ slug: string; tab?: string[] }>;
}

export async function generateStaticParams() {
  if (process.env.NEXT_PUBLIC_LEETPROOF_SERVERLESS !== "true") return [];
  const db = await getServerDatabase();
  const { problems } = await db.getProblems({ limit: 10000 });
  // For each problem, generate the base route (no tab segments).
  // Tab sub-routes (solutions, submissions) use client-side replaceState.
  return problems.flatMap((p) => [
    { slug: p.slug, tab: [] },
    { slug: p.slug, tab: ["solutions"] },
    { slug: p.slug, tab: ["submissions"] },
    { slug: p.slug, tab: ["hints"] },
  ]);
}

export async function generateMetadata({
  params,
}: ProblemPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = await getServerDatabase();
  const problem = await db.getProblemBySlug(slug);

  if (!problem) {
    return {
      title: "Problem Not Found - LeetProof",
    };
  }

  return {
    title: `${problem.title} - LeetProof`,
    description: problem.description?.substring(0, 160) || "Solve a Lean 4 theorem proving problem",
  };
}

export default async function ProblemPage({ params }: ProblemPageProps) {
  const { slug, tab } = await params;
  const db = await getServerDatabase();
  const problem = await db.getProblemBySlug(slug);

  if (!problem) {
    notFound();
  }

  const p = problem as Problem;

  // Parse tab segments: [] = description, ["solutions"] = solutions,
  // ["submissions"] = submissions
  const tabSegments = tab || [];
  const initialTab = (tabSegments[0] === "solutions" || tabSegments[0] === "submissions" || tabSegments[0] === "hints")
    ? tabSegments[0]
    : "description";

  return (
    <div className="flex flex-1 min-h-0 w-full p-[1px]">
      <ResizableProblemLayout
        left={
          <ProblemTabs
            problem={p}
            initialTab={initialTab}
          />
        }
        right={
          <div className="h-full min-h-0 w-full">
            <Lean4Editor
              code={p.starter_code}
              problemId={p.id}
              problemSlug={p.slug}
              mainTheoremName={p.main_theorem_name ?? undefined}
              theoremType={p.theorem_type ?? undefined}
              allowedAxioms={p.allowed_axioms ?? undefined}
            />
          </div>
        }
      />
    </div>
  );
}
