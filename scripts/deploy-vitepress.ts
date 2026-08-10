import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import "./load-env";

interface DeployOptions {
  skipDb: boolean;
  skipBuild: boolean;
  skipDeploy: boolean;
  useSqlDump: boolean;
  projectName: string;
}

function showHelp() {
  console.log(`
==================================================
hoGAMEGATA VitePress Export & Deploy Orchestrator
==================================================
Usage:
  npx tsx scripts/deploy-vitepress.ts [options]

Options:
  --skip-db, --skip-export  Skip DB query & markdown regeneration (use existing markdown)
  --skip-build              Skip VitePress site compilation (use existing dist build)
  --skip-deploy             Skip deployment step (export & build only)
  --deploy-only             Skip DB query & VitePress build (deploy existing dist directly)
  --build-only              Skip DB query & deployment (build existing markdown to dist)
  --export-only             Export DB to markdown only (skip build & deploy)
  --sql-dump                Use local dump.sql instead of live Turso DB query for export
  --project <name>          Cloudflare Pages project name (default: hogamegata-vitepress)
  --help                    Show this help screen

Examples:
  # Full pipeline (DB query -> VitePress build -> Deploy)
  npx tsx scripts/deploy-vitepress.ts

  # Fast deploy after fixing a typo in markdown / config (SKIP DB query)
  npx tsx scripts/deploy-vitepress.ts --skip-db

  # Deploy existing built site immediately (SKIP DB & Build)
  npx tsx scripts/deploy-vitepress.ts --deploy-only
`);
}

function runCommand(command: string, args: string[], cwd: string = process.cwd()): Promise<number> {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    console.log(`\n--------------------------------------------------`);
    console.log(`🚀 RUNNING: ${command} ${args.join(" ")}`);
    console.log(`📁 CWD: ${cwd}`);
    console.log(`--------------------------------------------------\n`);

    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: isWindows,
      env: { ...process.env, FORCE_COLOR: "1" },
    });

    child.on("close", (code) => {
      resolve(code || 0);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    process.exit(0);
  }

  const options: DeployOptions = {
    skipDb: args.includes("--skip-db") || args.includes("--skip-export") || args.includes("--deploy-only") || args.includes("--build-only"),
    skipBuild: args.includes("--skip-build") || args.includes("--deploy-only") || args.includes("--export-only"),
    skipDeploy: args.includes("--skip-deploy") || args.includes("--build-only") || args.includes("--export-only"),
    useSqlDump: args.includes("--sql-dump"),
    projectName: "hogamegata-vitepress",
  };

  const projectIdx = args.indexOf("--project");
  if (projectIdx !== -1 && args[projectIdx + 1]) {
    options.projectName = args[projectIdx + 1].trim();
  }

  console.log(`==================================================`);
  console.log(`🌐 VITEPRESS PIPELINE ORCHESTRATOR`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🔧 Settings:`);
  console.log(`   - Step 1 (DB Export):    ${options.skipDb ? "⏭️ SKIPPED" : options.useSqlDump ? "🟢 RUN (from dump.sql)" : "🟢 RUN (from Turso DB)"}`);
  console.log(`   - Step 2 (Docs Build):  ${options.skipBuild ? "⏭️ SKIPPED" : "🟢 RUN (vitepress build)"}`);
  console.log(`   - Step 3 (Deployment):  ${options.skipDeploy ? "⏭️ SKIPPED" : `🟢 RUN (Cloudflare Pages: ${options.projectName})`}`);
  console.log(`==================================================\n`);

  const startTime = Date.now();
  const vitepressDir = path.join(process.cwd(), "vitepress-index");
  const distDir = path.join(vitepressDir, "docs", ".vitepress", "dist");

  // STAGE 1: Database Query & Markdown Export
  if (!options.skipDb) {
    const exportScript = options.useSqlDump ? "scripts/generate-from-sql-dump.ts" : "scripts/generate-vitepress-index.ts";
    console.log(`\n📦 [STAGE 1/3] Generating VitePress Markdown Pages...`);
    const code = await runCommand("npx", ["tsx", exportScript]);
    if (code !== 0) {
      console.error(`❌ STAGE 1 FAILED with exit code ${code}. Aborting pipeline.`);
      process.exit(code);
    }
    console.log(`✅ [STAGE 1/3] Markdown pages generated successfully.`);
  } else {
    console.log(`⏭️ [STAGE 1/3] Skipped DB fetch & markdown export.`);
  }

  // STAGE 2: VitePress Build
  if (!options.skipBuild) {
    console.log(`\n🔨 [STAGE 2/3] Building VitePress Static Site...`);
    const code = await runCommand("npx", ["vitepress", "build", "docs"], vitepressDir);
    if (code !== 0) {
      console.error(`❌ STAGE 2 FAILED with exit code ${code}. Aborting pipeline.`);
      process.exit(code);
    }
    console.log(`✅ [STAGE 2/3] VitePress static site built successfully.`);
  } else {
    console.log(`⏭️ [STAGE 2/3] Skipped VitePress build.`);
  }

  // STAGE 3: Deploy to Cloudflare Pages
  if (!options.skipDeploy) {
    if (!fs.existsSync(distDir)) {
      console.error(`❌ Deployment failed: Build output directory does not exist at ${distDir}`);
      console.error(`👉 Run without --skip-build to compile the site first.`);
      process.exit(1);
    }

    console.log(`\n🚀 [STAGE 3/3] Deploying VitePress Site to Cloudflare Pages...`);
    const deployArgs = ["wrangler", "pages", "deploy", distDir, `--project-name=${options.projectName}`];
    const code = await runCommand("npx", deployArgs);

    if (code !== 0) {
      console.warn(`⚠️ Cloudflare Pages deployment exited with code ${code}. Trying fallback git push if available...`);
      // Fallback: check if vitepress-index is a git repo or if git push can be run
      const gitCode = await runCommand("git", ["status"], vitepressDir);
      if (gitCode === 0) {
        console.log(`ℹ️ Git repository detected in vitepress-index. Attempting git commit & push fallback...`);
        await runCommand("git", ["add", "."], vitepressDir);
        await runCommand("git", ["commit", "-m", "chore: vitepress auto-build update"], vitepressDir);
        await runCommand("git", ["push"], vitepressDir);
      }
    } else {
      console.log(`✅ [STAGE 3/3] Deployed to Cloudflare Pages (${options.projectName}) successfully.`);
    }
  } else {
    console.log(`⏭️ [STAGE 3/3] Skipped deployment step.`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n==================================================`);
  console.log(`🎉 PIPELINE COMPLETED IN ${duration}s`);
  console.log(`==================================================\n`);
}

main().catch((err) => {
  console.error("❌ Orchestrator error:", err);
  process.exit(1);
});
