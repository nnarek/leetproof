import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LeetProof - Theorem Proving Platform",
  description:
    "Sharpen your Lean 4 skills by proving theorems and verifying code. Share solutions and hints with the community.",
};

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/5 via-transparent to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-7xl">
              Leet<span className="text-accent">Proof</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted sm:text-xl">
              Prove theorems in{" "}
              <span className="font-semibold text-foreground">Lean 4</span>, share
              your solutions, and sharpen your formal verification skills.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/problems"
                className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent/90"
              >
                Start Solving →
              </Link>
              <a
                href="https://lean-lang.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border px-6 py-3 text-sm font-semibold text-muted transition hover:border-accent/50 hover:text-foreground"
              >
                Learn Lean 4
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* What is LeetProof */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-foreground">
              What is LeetProof?
            </h2>
            <p className="mt-4 text-lg text-muted">
              LeetProof is a collaborative platform focused on{" "}
              <strong className="text-foreground">formal verification</strong>{" "}
              using the Lean 4 programming language. Instead of writing
              algorithms, you write{" "}
              <strong className="text-foreground">mathematical proofs</strong> and{" "}
              <strong className="text-foreground">verified programs</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-16 text-center text-3xl font-bold text-foreground">
            How It Works
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-xl border border-border bg-surface/50 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                1. Pick a Problem
              </h3>
              <p className="text-sm text-muted">
                Browse problems by difficulty — easy, medium, or hard. Each
                problem describes a theorem to prove or code to verify in Lean
                4.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-xl border border-border bg-surface/50 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                2. Write Your Proof
              </h3>
              <p className="text-sm text-muted">
                Use the built-in Lean 4 editor powered by{" "}
                <strong className="text-foreground">lean4web</strong>. Get
                real-time feedback, goal states, and error messages as you
                construct your proof.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-xl border border-border bg-surface/50 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                3. Verify & Submit
              </h3>
              <p className="text-sm text-muted">
                When Lean&apos;s type checker accepts your proof with no errors,
                you&apos;ve solved it! Track your progress and compare with
                other users.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Topics */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-foreground">
            Problem Categories
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: "Logic & Propositional",
                desc: "And, Or, Implies, Not, Iff",
              },
              {
                name: "Natural Numbers",
                desc: "Induction, recursion, arithmetic",
              },
              {
                name: "Algebraic Structures",
                desc: "Groups, rings, monoids",
              },
              {
                name: "Program Verification",
                desc: "Verify correctness of algorithms",
              },
            ].map((cat) => (
              <div
                key={cat.name}
                className="rounded-lg border border-border bg-surface/30 p-6 transition hover:border-accent/50"
              >
                <h3 className="font-semibold text-foreground">{cat.name}</h3>
                <p className="mt-1 text-sm text-muted">{cat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground">
            Ready to prove something?
          </h2>
          <p className="mt-4 text-lg text-muted">
            Sign in with Google and start solving problems today.
          </p>
          <Link
            href="/problems"
            className="mt-8 inline-block rounded-lg bg-accent px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent/90"
          >
            Browse Problems
          </Link>
        </div>
      </section>
    </div>
  );
}
