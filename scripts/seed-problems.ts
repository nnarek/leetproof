/**
 * Seed script: loads problem markdown files from /problems into Supabase.
 * Automatically creates required tables if they don't exist.
 *
 * Usage:
 *   npx tsx scripts/seed-problems.ts
 *
 * Requirements:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - For auto-migration (if tables don't exist yet), one of:
 *     a) Supabase CLI logged in + project linked  (recommended, uses Management API)
 *     b) DATABASE_URL in .env.local               (direct Postgres connection)
 */

import fs from "fs";
import path from "path";
import dns from "dns";
import matter from "gray-matter";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import dotenv from "dotenv";

// Force Node.js DNS to resolve IPv4 first (avoids IPv6 ENETUNREACH on some hosts)
dns.setDefaultResultOrder("ipv4first");

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  console.error("   Please set these environment variables before running.");
  process.exit(1);
}

// Use the service role key for admin access (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const PROBLEMS_DIR = path.resolve(process.cwd(), "problems");
const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");

/**
 * Try running migration SQL via the Supabase Management API (pure HTTP, no direct DB needed).
 * Requires: Supabase CLI logged in (npx supabase login) + project linked (npx supabase link).
 * Reads the access token from ~/.supabase/access-token.
 */
async function runMigrationViaManagementAPI(migrationSQL: string): Promise<boolean> {
  const ref = getProjectRef();
  if (!ref) return false;

  // Read Supabase CLI access token
  const tokenPath = path.join(
    process.env.HOME || process.env.USERPROFILE || "~",
    ".supabase",
    "access-token"
  );

  let accessToken: string;
  try {
    accessToken = fs.readFileSync(tokenPath, "utf-8").trim();
  } catch {
    console.log("   → No Supabase CLI access token found. Skipping.");
    console.log("     Run 'npx supabase login' to authenticate.\n");
    return false;
  }

  if (!accessToken) {
    console.log("   → Supabase CLI access token is empty. Skipping.\n");
    return false;
  }

  console.log("   Method 1: Trying Supabase Management API (HTTP)...");

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query: migrationSQL }),
      }
    );

    if (response.ok) {
      return true;
    }

    const body = await response.text();
    console.log(`   → Management API returned ${response.status}: ${body.substring(0, 200)}\n`);
    return false;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`   → Management API request failed: ${message}\n`);
    return false;
  }
}

/**
 * Try running migration SQL via direct Postgres connection (pg library).
 */
async function runMigrationViaPg(sql: string): Promise<boolean> {
  if (!DATABASE_URL) {
    console.log("   → DATABASE_URL not set. Skipping.\n");
    return false;
  }

  console.log("   Method 2: Trying direct Postgres connection...");

  if (DATABASE_URL.includes(".supabase.co") && !DATABASE_URL.includes("pooler.supabase.com")) {
    console.log("   ⚠️  Using direct host (may fail on IPv6-only networks).");
  }

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    await client.query(sql);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`   → Postgres connection failed: ${message}\n`);
    return false;
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

/**
 * Extract the Supabase project ref from the URL.
 */
function getProjectRef(): string {
  const match = SUPABASE_URL!.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : "";
}

/**
 * Run migration files beyond 001 (incremental schema updates).
 * Each migration is idempotent, so it's safe to re-run.
 */
async function runAdditionalMigrations(): Promise<void> {
  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && f !== "001_initial_schema.sql")
    .sort();

  if (migrationFiles.length === 0) return;

  for (const file of migrationFiles) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    console.log(`📦 Running migration: ${file}`);

    let success = await runMigrationViaManagementAPI(sql);
    if (!success) {
      success = await runMigrationViaPg(sql);
    }

    if (success) {
      console.log(`   ✅ ${file} applied.\n`);
    } else {
      console.error(`   ⚠️  Could not apply ${file} automatically.`);
      console.error(`   Please run it manually in the Supabase SQL Editor.\n`);
    }
  }

  // Wait for PostgREST schema cache to refresh
  await new Promise((r) => setTimeout(r, 2000));
}

/**
 * Ensure the required database tables exist by checking and running migration.
 */
async function ensureTablesExist(): Promise<void> {
  // Check if the problems table already exists via the REST API
  const { error } = await supabase
    .from("problems")
    .select("id")
    .limit(1);

  if (!error) {
    console.log("✅ Database tables already exist.\n");
    // Run any additional migrations (002+)
    await runAdditionalMigrations();
    return;
  }

  // Table doesn't exist — try to run the migration
  console.log("📦 Tables not found. Running database migration...\n");

  const migrationFile = path.join(MIGRATIONS_DIR, "001_initial_schema.sql");
  if (!fs.existsSync(migrationFile)) {
    console.error("❌ Migration file not found:", migrationFile);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationFile, "utf-8");

  // Strategy 1: Supabase Management API (pure HTTP, works everywhere)
  let success = await runMigrationViaManagementAPI(migrationSQL);

  // Strategy 2: Direct Postgres connection via DATABASE_URL
  if (!success) {
    success = await runMigrationViaPg(migrationSQL);
  }

  if (success) {
    // Wait briefly for PostgREST schema cache to refresh
    await new Promise((r) => setTimeout(r, 2000));

    const { error: verifyError } = await supabase
      .from("problems")
      .select("id")
      .limit(1);

    if (!verifyError) {
      console.log("✅ Database migration completed successfully.\n");
      return;
    }

    // Partial success — check if it's just a cache lag
    console.log("   Waiting for schema cache to refresh...");
    await new Promise((r) => setTimeout(r, 5000));

    const { error: retryError } = await supabase
      .from("problems")
      .select("id")
      .limit(1);

    if (!retryError) {
      console.log("✅ Database migration completed successfully.\n");
      return;
    }

    console.error("   ⚠️  Migration ran but problems table not yet accessible.");
    console.error("   This could be a PostgREST cache delay. Try running 'npm run seed' again in 30s.\n");
    process.exit(1);
  }

  // All methods failed — print helpful instructions
  const ref = getProjectRef();
  console.error("❌ Could not create tables automatically.\n");
  console.error("   Please create the tables using ONE of these methods:\n");
  console.error("   ╭─ Method 1: Supabase SQL Editor (easiest) ────────────────────╮");
  console.error(`   │ 1. Open: https://supabase.com/dashboard/project/${ref}/sql/new`);
  console.error("   │ 2. Paste contents of: supabase/migrations/001_initial_schema.sql");
  console.error("   │ 3. Click 'Run', then re-run: npm run seed");
  console.error("   ╰──────────────────────────────────────────────────────────────╯\n");
  console.error("   ╭─ Method 2: Supabase CLI (recommended for automation) ────────╮");
  console.error("   │ npx supabase login");
  console.error("   │ npx supabase link --project-ref " + ref);
  console.error("   │ npm run seed   # will auto-detect linked project");
  console.error("   ╰──────────────────────────────────────────────────────────────╯\n");
  console.error("   ╭─ Method 3: Fix DATABASE_URL in .env.local ───────────────────╮");
  console.error("   │ Get the connection string from:");
  console.error("   │ Supabase Dashboard → Settings → Database → Connection string");
  console.error("   │ Use 'Session mode' URI (pooler.supabase.com)");
  console.error("   │ Ensure the password is your DATABASE password");
  console.error("   ╰──────────────────────────────────────────────────────────────╯\n");
  process.exit(1);
}

interface ProblemFrontmatter {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  sort_order: number;
  starter_code: string;
  main_theorem_name: string;
  theorem_type: string;
  allowed_axioms: string[];
}

async function main() {
  console.log("🌱 Seeding problems from", PROBLEMS_DIR);
  console.log("   Supabase URL:", SUPABASE_URL);
  console.log("");

  // Ensure database tables exist before seeding
  await ensureTablesExist();

  // Read all markdown files
  const files = fs
    .readdirSync(PROBLEMS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  if (files.length === 0) {
    console.log("⚠️  No .md files found in /problems directory.");
    return;
  }

  console.log(`📄 Found ${files.length} problem files:\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const filePath = path.join(PROBLEMS_DIR, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);

    const frontmatter = data as ProblemFrontmatter;

    // Validate required fields
    if (
      !frontmatter.slug ||
      !frontmatter.title ||
      !frontmatter.difficulty
    ) {
      console.error(`  ❌ ${file}: missing required frontmatter (slug, title, difficulty)`);
      errorCount++;
      continue;
    }

    const problem = {
      slug: frontmatter.slug,
      title: frontmatter.title,
      difficulty: frontmatter.difficulty,
      description: content.trim(),
      starter_code: (frontmatter.starter_code || "").trim(),
      tags: frontmatter.tags || [],
      sort_order: frontmatter.sort_order || 0,
      main_theorem_name: frontmatter.main_theorem_name || null,
      theorem_type: frontmatter.theorem_type || null,
      allowed_axioms: frontmatter.allowed_axioms || null,
    };

    // Upsert: insert or update if slug already exists
    const { error } = await supabase
      .from("problems")
      .upsert(problem, { onConflict: "slug" });

    if (error) {
      console.error(`  ❌ ${file}: ${error.message}`);
      errorCount++;
    } else {
      console.log(
        `  ✅ ${file} → "${problem.title}" [${problem.difficulty}]`
      );
      successCount++;
    }
  }

  console.log("");
  console.log(`✨ Done! ${successCount} succeeded, ${errorCount} failed.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
