import { Suspense } from "react";
import ProblemsClient from "./ProblemsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Problems - LeetProof",
  description: "Browse and solve Lean 4 theorem proving problems",
};

export default function ProblemsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[90rem] px-4 py-4 sm:px-6 lg:px-8">
          <p className="mt-2 text-zinc-400">Loading...</p>
        </div>
      }
    >
      <ProblemsClient />
    </Suspense>
  );
}
