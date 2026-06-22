import * as http from "http";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";

// Simple env loader to parse DATABASE_URL correctly including handling Windows carriage returns
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (let line of content.split("\n")) {
      line = line.trim();
      if (!line || line.startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index === -1) continue;
      const key = line.substring(0, index).trim();
      let value = line.substring(index + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}
loadEnv();

// Global server state
let currentProcess: ChildProcess | null = null;
let currentCommandName: string = "";
let status: "idle" | "running" = "idle";
let logBuffer: string = "";
const sseClients: Set<http.ServerResponse> = new Set();

const PORT = parseInt(process.env.PORT || "4000", 10);

// Cron Scheduler Setup
interface CronJob {
  id: string;
  name: string;
  command: string;
  args: string[];
  intervalMs: number;
  lastRun: string | null;
  lastStatus: "success" | "failed" | null;
  enabled: boolean;
  nextRunTime: number; // Timestamp
}

const cronJobs: CronJob[] = [
  {
    id: "pipeline-sync",
    name: "hoGAMEGATA Master Sync Pipeline",
    command: "pipeline",
    args: ["--sync", "--limit", "100"],
    intervalMs: 24 * 60 * 60 * 1000, // 24 Hours
    lastRun: null,
    lastStatus: null,
    enabled: true,
    nextRunTime: Date.now() + 24 * 60 * 60 * 1000,
  },
  {
    id: "price-sync",
    name: "Price Sync Aggregator",
    command: "sync-prices",
    args: [],
    intervalMs: 12 * 60 * 60 * 1000, // 12 Hours
    lastRun: null,
    lastStatus: null,
    enabled: true,
    nextRunTime: Date.now() + 12 * 60 * 60 * 1000,
  }
];

// Helper to broadcast log line to all active SSE clients
function broadcastLog(data: string) {
  logBuffer += data;
  if (logBuffer.length > 100000) {
    logBuffer = logBuffer.substring(logBuffer.length - 80000);
  }
  const formatted = JSON.stringify({ type: "log", data });
  for (const client of sseClients) {
    client.write(`data: ${formatted}\n\n`);
  }
}

// Helper to broadcast status updates to all active SSE clients
function broadcastStatus() {
  const formatted = JSON.stringify({ 
    type: "status", 
    status, 
    command: currentCommandName,
    cronJobs: cronJobs.map(c => ({
      id: c.id,
      name: c.name,
      enabled: c.enabled,
      lastRun: c.lastRun,
      lastStatus: c.lastStatus,
      nextRunTime: c.nextRunTime
    }))
  });
  for (const client of sseClients) {
    client.write(`data: ${formatted}\n\n`);
  }
}

// Kill the current running child process
function killCurrentProcess() {
  if (currentProcess) {
    broadcastLog("\n⚠️ Abort requested by user. Terminating process...\n");
    if (process.platform === "win32") {
      try {
        spawn("taskkill", ["/pid", currentProcess.pid!.toString(), "/f", "/t"]);
      } catch (err) {
        currentProcess.kill("SIGKILL");
      }
    } else {
      try {
        // Send signal to the process group (minus sign before PID) to kill parent and all child processes
        process.kill(-currentProcess.pid!, "SIGINT");
        setTimeout(() => {
          if (currentProcess) {
            try {
              process.kill(-currentProcess.pid!, "SIGKILL");
            } catch (e) {}
          }
        }, 1000);
      } catch (err) {
        // Fallback to killing just the parent process
        currentProcess.kill("SIGINT");
        setTimeout(() => {
          if (currentProcess) currentProcess.kill("SIGKILL");
        }, 1000);
      }
    }
  }
}

// Start a command / script asynchronously
function startScript(scriptPath: string, args: string[], displayCommand: string, onComplete?: (code: number) => void) {
  if (status === "running") {
    broadcastLog("\n❌ Error: A process is already running. Please wait or abort it first.\n");
    return false;
  }

  status = "running";
  currentCommandName = displayCommand;
  logBuffer = ""; // Reset log buffer for the new run
  broadcastStatus();

  const isWindows = process.platform === "win32";
  const env = { ...process.env, FORCE_COLOR: "1" };

  let child: ChildProcess;

  if (scriptPath === "git") {
    broadcastLog(`\n==================================================\n`);
    broadcastLog(`🚀 RUNNING DIRECT: git ${args.join(" ")}\n`);
    broadcastLog(`==================================================\n\n`);
    child = spawn("git", args, {
      shell: isWindows,
      env,
      detached: !isWindows, // Start in a new process group on Linux/macOS
    });
  } else {
    broadcastLog(`\n==================================================\n`);
    broadcastLog(`🚀 RUNNING SCRIPT: npx tsx ${scriptPath} ${args.join(" ")}\n`);
    broadcastLog(`==================================================\n\n`);
    child = spawn("npx", ["tsx", scriptPath, ...args], {
      shell: isWindows,
      env,
      detached: !isWindows, // Start in a new process group on Linux/macOS
    });
  }

  currentProcess = child;

  child.stdout?.on("data", (data) => {
    broadcastLog(data.toString());
  });

  child.stderr?.on("data", (data) => {
    broadcastLog(data.toString());
  });

  child.on("error", (err) => {
    broadcastLog(`\n❌ Spawn Error: ${err.message}\n`);
  });

  child.on("close", (code) => {
    broadcastLog(`\n\n==================================================\n`);
    broadcastLog(`🏁 COMPLETED: Exit Code ${code}\n`);
    broadcastLog(`==================================================\n`);
    
    currentProcess = null;
    status = "idle";
    currentCommandName = "";
    broadcastStatus();

    if (onComplete) {
      onComplete(code || 0);
    }
  });

  return true;
}

// Map command keys to their target paths
const SCRIPT_MAPPING: Record<string, string> = {
  "ingest": "scripts/ingest.ts",
  "enrich": "scripts/enrich.ts",
  "enrich-itch": "scripts/enrich-itch.ts",
  "add-custom-itch": "scripts/add-custom-itch.ts",
  "sync-prices": "scripts/sync-prices.ts",
  "setup-fts": "scripts/setup_fts.ts",
  "scare": "scripts/enrich-scare.ts",
  "git": "git",
  "git-sync": "scripts/git-sync.ts",
  "pipeline": "scripts/run-pipeline.ts",
  "retro-ingest": "scripts/ingest.ts",
};

// Background Cron Job Runner Loop (every 5 seconds)
setInterval(() => {
  const now = Date.now();
  for (const job of cronJobs) {
    if (job.enabled && now >= job.nextRunTime) {
      // Defer check if a process is already running manually or by another cron
      if (status === "running") {
        // Postpone by 1 minute
        job.nextRunTime = now + 60 * 1000;
        continue;
      }

      // Trigger script
      const scriptPath = SCRIPT_MAPPING[job.command];
      if (scriptPath) {
        job.lastRun = new Date().toISOString();
        broadcastLog(`\n⏰ [CRON ACTIVATED] Triggering scheduled job: ${job.name}\n`);
        
        startScript(scriptPath, job.args, `[Cron] ${job.name}`, (code) => {
          job.lastStatus = code === 0 ? "success" : "failed";
          job.nextRunTime = Date.now() + job.intervalMs;
          broadcastStatus();
        });
      }
    }
  }
}, 5000);

// The complete single-page HTML client served at "/"
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>hoGAMEGATA Developer Portal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0a0b0e;
      --bg-card: #12141a;
      --bg-card-hover: #171b24;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --accent: #8b5cf6;
      --accent-glow: rgba(139, 92, 246, 0.4);
      --accent-cyan: #06b6d4;
      --accent-cyan-glow: rgba(6, 182, 212, 0.4);
      --border-color: #212631;
      --danger: #ef4444;
      --danger-glow: rgba(239, 68, 68, 0.4);
      --success: #10b981;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: 'Inter', sans-serif;
      line-height: 1.5;
      padding-bottom: 2rem;
    }

    header {
      background: linear-gradient(135deg, #11141e 0%, #0c0e15 100%);
      border-bottom: 1px solid var(--border-color);
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(12px);
    }

    .header-logo h1 {
      font-size: 1.4rem;
      font-weight: 700;
      background: linear-gradient(90deg, var(--accent) 0%, var(--accent-cyan) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: 0.5px;
    }

    .header-logo p {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.1rem;
    }

    .status-panel {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .status-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.8rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      border: 1px solid var(--border-color);
      background-color: rgba(255, 255, 255, 0.03);
    }

    .status-badge.idle {
      color: var(--success);
      border-color: rgba(16, 185, 129, 0.2);
      background-color: rgba(16, 185, 129, 0.05);
    }

    .status-badge.running {
      color: #f59e0b;
      border-color: rgba(245, 158, 11, 0.2);
      background-color: rgba(245, 158, 11, 0.05);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.6; }
      100% { opacity: 1; }
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      font-size: 0.8rem;
      font-weight: 500;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background-color: rgba(255, 255, 255, 0.05);
      color: var(--text-main);
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .btn:hover:not(:disabled) {
      background-color: rgba(255, 255, 255, 0.1);
      border-color: var(--text-muted);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%);
      border: none;
      box-shadow: 0 0 10px var(--accent-glow);
    }

    .btn-primary:hover:not(:disabled) {
      box-shadow: 0 0 15px var(--accent);
      transform: translateY(-1px);
    }

    .btn-cyan {
      background: linear-gradient(135deg, var(--accent-cyan) 0%, #0891b2 100%);
      border: none;
      box-shadow: 0 0 10px var(--accent-cyan-glow);
    }

    .btn-cyan:hover:not(:disabled) {
      box-shadow: 0 0 15px var(--accent-cyan);
      transform: translateY(-1px);
    }

    .btn-danger {
      background: linear-gradient(135deg, var(--danger) 0%, #dc2626 100%);
      border: none;
      box-shadow: 0 0 10px var(--danger-glow);
    }

    .btn-danger:hover:not(:disabled) {
      box-shadow: 0 0 15px var(--danger);
      transform: translateY(-1px);
    }

    .container {
      max-width: 1400px;
      margin: 2rem auto;
      padding: 0 1.5rem;
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 2rem;
    }

    @media (max-width: 1024px) {
      .container {
        grid-template-columns: 1fr;
      }
    }

    .controls-grid {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .card:hover {
      background-color: var(--bg-card-hover);
      border-color: #2e3545;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }

    .card h2 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 0.4rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .card h2 .num {
      background-color: rgba(255, 255, 255, 0.06);
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 0.75rem;
      color: var(--text-muted);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .card > p {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 1.2rem;
    }

    .actions-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .actions-row:last-child {
      margin-bottom: 0;
    }

    .form-group {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      width: 100%;
    }

    .form-group label {
      font-size: 0.8rem;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .input-control {
      background-color: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 0.45rem 0.75rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-family: inherit;
      flex: 1;
      min-width: 80px;
      transition: border-color 0.2s;
    }

    .input-control:focus {
      outline: none;
      border-color: var(--accent);
    }

    .badge-info {
      font-size: 0.75rem;
      background-color: rgba(6, 182, 212, 0.1);
      border: 1px solid rgba(6, 182, 212, 0.2);
      color: var(--accent-cyan);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      margin-top: 0.5rem;
      display: inline-block;
    }

    /* Terminal View */
    .terminal-container {
      display: flex;
      flex-direction: column;
      height: 85vh;
      background-color: #050608;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
      position: sticky;
      top: 6rem;
    }

    .terminal-header {
      background-color: #0c0e14;
      border-bottom: 1px solid var(--border-color);
      padding: 0.75rem 1.2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .terminal-title {
      font-size: 0.85rem;
      font-family: 'Fira Code', monospace;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .terminal-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: var(--success);
    }

    .terminal-dot.active {
      background-color: #f59e0b;
      animation: pulse 1.5s infinite;
    }

    .terminal-output {
      flex: 1;
      padding: 1rem;
      overflow-y: auto;
      font-family: 'Fira Code', monospace;
      font-size: 0.85rem;
      line-height: 1.4rem;
      color: #e5e7eb;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .help-tooltip {
      font-size: 0.75rem;
      background-color: rgba(255, 255, 255, 0.03);
      padding: 0.5rem;
      border-left: 2px solid var(--accent);
      border-radius: 0 4px 4px 0;
      margin-bottom: 0.75rem;
    }

    /* Git & Scheduler Section styling */
    .cron-item {
      border-bottom: 1px solid var(--border-color);
      padding: 0.75rem 0;
    }
    .cron-item:last-child {
      border-bottom: none;
    }
    .cron-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.3rem;
    }
    .cron-name {
      font-size: 0.9rem;
      font-weight: 600;
    }
    .cron-meta {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .cron-badge {
      font-size: 0.7rem;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      font-weight: 500;
      background-color: rgba(255,255,255,0.06);
    }
    .cron-badge.success {
      color: var(--success);
      background-color: rgba(16, 185, 129, 0.1);
    }
    .cron-badge.failed {
      color: var(--danger);
      background-color: rgba(239, 68, 68, 0.1);
    }

    /* Simple switch checkbox styling */
    .switch {
      position: relative;
      display: inline-block;
      width: 34px;
      height: 20px;
    }
    .switch input { 
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: rgba(255,255,255,0.1);
      transition: .4s;
      border-radius: 20px;
      border: 1px solid var(--border-color);
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 14px; width: 14px;
      left: 2px; bottom: 2px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    input:checked + .slider {
      background-color: var(--accent);
    }
    input:checked + .slider:before {
      transform: translateX(14px);
    }
    .maintenance-banner {
      background-color: var(--danger);
      color: white;
      text-align: center;
      padding: 0.6rem;
      font-weight: 800;
      font-size: 0.85rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
  </style>
</head>
<body>

  <div id="maintenanceBanner" class="maintenance-banner" style="display:none;">
    ⚠️ WEBSITE IS CURRENTLY IN MAINTENANCE MODE (OFFLINE FOR USERS)
  </div>

  <header>
    <div class="header-logo">
      <h1>hoGAMEGATA</h1>
      <p>UNIFIED DEVELOPER PORTAL GUI</p>
    </div>
    <div class="status-panel">
      <div id="statusBadge" class="status-badge idle">
        <span class="status-indicator-dot">●</span>
        <span id="statusText">IDLE</span>
      </div>
      <button id="killBtn" class="btn btn-danger" disabled onclick="killActiveProcess()">Abort Task</button>
    </div>
  </header>

  <main class="container">
    <!-- Category Operations Left Column -->
    <div class="controls-grid">

      <!-- Maintenance Mode Card -->
      <div class="card" style="border-left: 3px solid var(--danger);">
        <h2><span style="color:var(--danger);">⚠️</span> Website Maintenance Mode</h2>
        <p>Toggle website maintenance mode. Toggling this affects both localhost and Vercel cloud instantly.</p>
        <div class="actions-row" style="margin-top: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
          <span id="maintenanceStatusLabel" style="font-weight: 800; text-transform: uppercase; font-size: 0.9rem; color: var(--text-muted);">Checking...</span>
          <button id="toggleMaintenanceBtn" class="btn btn-danger" onclick="toggleMaintenance()">Toggle Mode</button>
        </div>
      </div>

      <!-- Git Integration Card -->
      <div class="card" style="border-left: 3px solid var(--accent-cyan);">
        <h2><span style="color:var(--accent-cyan);">📂</span> Git Integration & Deploy</h2>
        <p>Monitor git states and push modifications directly from the developer console.</p>
        <div class="actions-row">
          <button class="btn btn-cyan" onclick="runCommand('git', ['status'], 'Git Status')">Git Status</button>
          <button class="btn" onclick="runCommand('git', ['pull'], 'Git Pull')">Git Pull</button>
        </div>
        <div class="help-tooltip" style="border-left-color: var(--accent-cyan); margin-top: 0.75rem;">
          <strong>Stage, Commit & Push changes:</strong>
        </div>
        <div class="actions-row">
          <div class="form-group">
            <input type="text" id="gitMessage" class="input-control" placeholder="Commit message (e.g. Ingested new catalog batch)">
            <button class="btn btn-primary" onclick="runGitSync()">Commit & Push</button>
          </div>
        </div>
      </div>

      <!-- Scheduler / Cron Jobs Card -->
      <div class="card" style="border-left: 3px solid #f59e0b;">
        <h2><span style="color:#f59e0b;">⏰</span> Automated Cron Jobs (Scheduler)</h2>
        <p>Manage in-memory scheduled background jobs executing on the portal runner.</p>
        
        <div id="cronList">
          <!-- Populated by JavaScript status fetch -->
          <div class="cron-item">Loading schedules...</div>
        </div>
      </div>

      <!-- Section 1 -->
      <div class="card">
        <h2><span class="num">1</span> IGDB Catalog Ingestion</h2>
        <p>Control the primary IGDB games ingest catalog pipeline.</p>
        <div class="actions-row">
          <button class="btn btn-primary" onclick="runCommand('ingest', ['--sync'], 'Sync Incremental Ingestion')">Sync modifications (Incremental)</button>
          <button class="btn btn-danger" onclick="confirmResetIngest()">Full Ingest (Reset cursor)</button>
        </div>
        <div class="actions-row">
          <div class="form-group">
            <label for="ingestLimit">Limit Size:</label>
            <input type="number" id="ingestLimit" class="input-control" placeholder="e.g. 1000" min="1">
            <button class="btn" onclick="runIngestWithLimit()">Run Ingestion with Limit</button>
          </div>
        </div>
      </div>

      <!-- Section Retro Ingest -->
      <div class="card" style="border-left: 3px solid var(--accent-cyan);">
        <h2><span class="num">↩</span> Retro / Abandonware Ingestion</h2>
        <p>Ingest retro horror games from Archive.org, Abandonia, and MyAbandonware.</p>
        <div class="actions-row">
          <button class="btn btn-cyan" onclick="runCommand('retro-ingest', ['--retro'], 'Retro Horror Ingestion')">Start Retro Ingest</button>
        </div>
        <div class="help-tooltip" style="margin-top:0.5rem;">
          <strong>Sources:</strong> Archive.org (classicgaming), Abandonia, MyAbandonware — public domain & abandonware titles only.
        </div>
      </div>

      <!-- Section 2 -->
      <div class="card">
        <h2><span class="num">2</span> RAWG & Steam Enrichment</h2>
        <p>Enrich catalog games with descriptions, banners, screenshots, and Steam pricing hooks.</p>
        <div class="actions-row">
          <button class="btn btn-primary" onclick="runCommand('enrich', [], 'Batch Enrichment')">Batch Enrichment</button>
        </div>
        <div class="actions-row">
          <div class="form-group">
            <label for="enrichLimit">Batch Limit:</label>
            <input type="number" id="enrichLimit" class="input-control" placeholder="Default 100" min="1">
            <button class="btn" onclick="runEnrichWithLimit()">Run Batch with Limit</button>
          </div>
        </div>
      </div>

      <!-- Section 3 -->
      <div class="card">
        <h2><span class="num">3</span> Itch.io Scraper & Ingest Console</h2>
        <p>Scrape, import, and enrich games published directly on itch.io.</p>
        
        <div class="help-tooltip">
          <strong>Standard Batch Action:</strong>
        </div>
        <div class="actions-row">
          <button class="btn btn-primary" onclick="runCommand('enrich-itch', ['--batch'], 'Itch Batch Enrichment')">Batch Enrich Unenriched Itch Games</button>
        </div>

        <div class="help-tooltip">
          <strong>Import Tag/Genre listings:</strong>
        </div>
        <div class="actions-row">
          <button class="btn" onclick="runCommand('enrich-itch', ['--list-url', 'https://itch.io/games/tag-3d/tag-horror'], 'Itch 3D Horror Popular')">3D Horror (Popular)</button>
          <button class="btn" onclick="runCommand('enrich-itch', ['--list-url', 'https://itch.io/games/new-and-popular/tag-3d/tag-horror'], 'Itch 3D Horror New & Popular')">3D Horror (New & Pop)</button>
          <button class="btn" onclick="runCommand('enrich-itch', ['--list-url', 'https://itch.io/games/top-rated/tag-3d/tag-horror'], 'Itch 3D Horror Top Rated')">3D Horror (Top Rated)</button>
        </div>

        <div class="help-tooltip">
          <strong>Enrich Specific Single Itch Game:</strong>
        </div>
        <div class="actions-row">
          <div class="form-group">
            <input type="text" id="itchSlug" class="input-control" placeholder="Itch Slug (e.g. itch-pyramida)">
            <button class="btn" onclick="runItchSlug()">Enrich Slug</button>
          </div>
        </div>
        <div class="actions-row">
          <div class="form-group">
            <input type="text" id="itchUrl" class="input-control" placeholder="Itch page URL">
            <button class="btn" onclick="runItchUrl()">Enrich URL</button>
          </div>
        </div>

        <div class="help-tooltip">
          <strong>Add Custom Game:</strong>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          <input type="text" id="customItchTitle" class="input-control" placeholder="Custom Game Title">
          <div class="form-group">
            <input type="text" id="customItchUrl" class="input-control" placeholder="https://author.itch.io/game">
            <button class="btn btn-cyan" onclick="addCustomItchGame()">Add & Enrich Custom Game</button>
          </div>
        </div>
      </div>

      <!-- Section 4 -->
      <div class="card">
        <h2><span class="num">4</span> Outbound Redirection Analytics</h2>
        <p>Outbound click tracking for referrals.</p>
        <span class="badge-info">💡 Operates automatically at runtime. Endpoint: /re/[slug]/[store]</span>
      </div>

      <!-- Section 5 -->
      <div class="card">
        <h2><span class="num">5</span> Price Sync Aggregator</h2>
        <p>Query external API providers (CheapShark/ITAD) to update latest deals.</p>
        <div class="actions-row">
          <button class="btn btn-cyan" onclick="runCommand('sync-prices', [], 'Sync Prices')">Run Deal Price Sync</button>
        </div>
      </div>

      <!-- Section 6 -->
      <div class="card">
        <h2><span class="num">6</span> PostgreSQL Search Indexes (FTS)</h2>
        <p>Setup or rebuild the Full-Text Search index triggers and search vectors in the db.</p>
        <div class="actions-row">
          <button class="btn btn-cyan" onclick="runCommand('setup-fts', [], 'Postgres FTS Index Setup')">Rebuild FTS Database Indexes</button>
        </div>
      </div>

      <!-- Section 7 -->
      <div class="card">
        <h2><span class="num">7</span> Scare Meter NLP AI Enrichment</h2>
        <p>Analyze descriptions with FreeLLM API (Gemini Fallback) to populate horror profiles.</p>
        <div class="actions-row">
          <button class="btn btn-primary" onclick="runCommand('scare', [], 'Default Scare Enrichment')">Run Default Batch (50)</button>
          <button class="btn" onclick="runCommand('scare', ['--limit', '500'], 'Large Scare Enrichment')">Run Large Batch (500)</button>
        </div>
        <div class="actions-row">
          <div class="form-group">
            <label for="scareLimit">Limit:</label>
            <input type="number" id="scareLimit" class="input-control" placeholder="Limit count" min="1">
            <button class="btn" onclick="runScareWithLimit()">Batch with Limit</button>
          </div>
        </div>
        <div class="actions-row">
          <div class="form-group">
            <label for="scareSlug">Slug:</label>
            <input type="text" id="scareSlug" class="input-control" placeholder="e.g. resident-evil-4">
            <button class="btn" onclick="runScareSlug()">Process Slug</button>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;">
          <div style="font-size:0.8rem; color:var(--text-muted);">Process by Tag Category:</div>
          <div class="form-group">
            <input type="text" id="scareTag" class="input-control" placeholder="Tag (e.g. survival-horror)">
            <input type="number" id="scareTagLimit" class="input-control" placeholder="Limit (e.g. 50)" style="max-width: 100px;">
            <button class="btn" onclick="runScareTag()">Process Tag</button>
          </div>
        </div>
      </div>

      <!-- Section 8 -->
      <div class="card">
        <h2><span class="num">8</span> Early Access Waitlist Manager</h2>
        <p>Review access requests and grant entry to waitlisted users.</p>
        <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Recent Requests</span>
            <button class="btn" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;" onclick="fetchWaitlist()">Refresh</button>
          </div>
          <div id="waitlistContainer" style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.25rem;">
            <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1rem;">Loading waitlist...</div>
          </div>
        </div>
      </div>

    </div>

    <!-- Terminal Output Right Column -->
    <div class="terminal-container">
      <div class="terminal-header">
        <div class="terminal-title">
          <div id="terminalDot" class="terminal-dot"></div>
          <span>TERMINAL CONSOLE</span>
        </div>
        <div>
          <button class="btn" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="clearTerminal()">Clear</button>
        </div>
      </div>
      <div id="terminal" class="terminal-output">Ready to execute tasks...</div>
    </div>
  </main>

  <script>
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const terminalDot = document.getElementById('terminalDot');
    const killBtn = document.getElementById('killBtn');
    const terminal = document.getElementById('terminal');
    const cronList = document.getElementById('cronList');

    // Subscribe to SSE stream for live log updates and current state
    const eventSource = new EventSource('/api/logs');

    eventSource.onmessage = function(event) {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'log') {
          let cleaned = payload.data
            .replace(/\\x1B\\[[0-9;]*[a-zA-Z]/g, '')
            .replace(/\\u001b\\[[0-9;]*[a-zA-Z]/g, '');
          
          if (terminal.innerText === 'Ready to execute tasks...') {
            terminal.innerText = '';
          }
          terminal.innerText += cleaned;
          terminal.scrollTop = terminal.scrollHeight;
        } else if (payload.type === 'status') {
          updateSystemStatus(payload.status, payload.command);
          if (payload.cronJobs) {
            renderCronJobs(payload.cronJobs);
          }
          if (payload.maintenanceMode !== undefined) {
            updateMaintenanceStatus(payload.maintenanceMode);
          }
        }
      } catch (e) {
        console.error("SSE parse error:", e);
      }
    };

    function updateSystemStatus(status, commandName) {
      if (status === 'running') {
        statusBadge.className = 'status-badge running';
        statusText.innerText = 'RUNNING: ' + commandName;
        terminalDot.className = 'terminal-dot active';
        killBtn.disabled = false;
        toggleAllActionButtons(true);
      } else {
        statusBadge.className = 'status-badge idle';
        statusText.innerText = 'IDLE';
        terminalDot.className = 'terminal-dot';
        killBtn.disabled = true;
        toggleAllActionButtons(false);
      }
    }

    function renderCronJobs(jobs) {
      cronList.innerHTML = '';
      jobs.forEach(job => {
        const item = document.createElement('div');
        item.className = 'cron-item';
        
        const nextDate = new Date(job.nextRunTime);
        const timeDiff = Math.max(0, Math.round((job.nextRunTime - Date.now()) / 1000));
        let nextRunStr = '';
        if (timeDiff > 3600) {
          nextRunStr = Math.round(timeDiff / 3600) + ' hrs';
        } else if (timeDiff > 60) {
          nextRunStr = Math.round(timeDiff / 60) + ' mins';
        } else {
          nextRunStr = timeDiff + ' secs';
        }

        const lastRunStr = job.lastRun ? new Date(job.lastRun).toLocaleTimeString() : 'Never';
        const badgeClass = job.lastStatus === 'success' ? 'cron-badge success' : (job.lastStatus === 'failed' ? 'cron-badge failed' : 'cron-badge');
        const badgeText = job.lastStatus ? job.lastStatus.toUpperCase() : 'NO RUNS';

        item.innerHTML = \`
          <div class="cron-item-header">
            <span class="cron-name">\${job.name}</span>
            <label class="switch">
              <input type="checkbox" \${job.enabled ? 'checked' : ''} onchange="toggleCron('\${job.id}', this.checked)">
              <span class="slider"></span>
            </label>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="cron-meta">
              <span>Last Run: <strong>\${lastRunStr}</strong></span>
              <span style="margin-left: 8px;">Next Run in: <strong>\${job.enabled ? nextRunStr : 'Disabled'}</strong></span>
            </div>
            <div style="display:flex; align-items:center; gap: 8px;">
              <span class="\${badgeClass}">\${badgeText}</span>
              <button class="btn" style="padding: 0.2rem 0.5rem; font-size:0.7rem;" onclick="triggerCronNow('\${job.id}')">Run Now</button>
            </div>
          </div>
        \`;
        cronList.appendChild(item);
      });
    }

    async function toggleCron(id, enabled) {
      await fetch('/api/cron/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled })
      });
    }

    async function triggerCronNow(id) {
      await fetch('/api/cron/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    }

    function toggleAllActionButtons(disabled) {
      const buttons = document.querySelectorAll('main .btn');
      buttons.forEach(btn => {
        if (btn.innerText !== 'Clear') {
          btn.disabled = disabled;
        }
      });
    }

    function updateMaintenanceStatus(enabled) {
      const banner = document.getElementById('maintenanceBanner');
      const label = document.getElementById('maintenanceStatusLabel');
      const btn = document.getElementById('toggleMaintenanceBtn');
      if (enabled) {
        banner.style.display = 'block';
        label.innerText = 'OFFLINE (MAINTENANCE ON)';
        label.style.color = 'var(--danger)';
        btn.innerText = 'Disable Maintenance Mode';
        btn.className = 'btn btn-success';
      } else {
        banner.style.display = 'none';
        label.innerText = 'ONLINE (NORMAL OPERATION)';
        label.style.color = 'var(--success)';
        btn.innerText = 'Enable Maintenance Mode';
        btn.className = 'btn btn-danger';
      }
    }

    async function toggleMaintenance() {
      const btn = document.getElementById('toggleMaintenanceBtn');
      btn.disabled = true;
      try {
        const res = await fetch('/api/maintenance/toggle', { method: 'POST' });
        const data = await res.json();
        updateMaintenanceStatus(data.enabled);
      } catch (e) {
        alert('Failed to toggle maintenance mode');
      } finally {
        btn.disabled = false;
      }
    }

    // Initialize initial state on load
    fetch('/api/status')
      .then(r => r.json())
      .then(data => {
        updateSystemStatus(data.status, data.command);
        if (data.cronJobs) {
          renderCronJobs(data.cronJobs);
        }
        if (data.maintenanceMode !== undefined) {
          updateMaintenanceStatus(data.maintenanceMode);
        }
        if (data.logBuffer) {
          terminal.innerText = data.logBuffer;
          terminal.scrollTop = terminal.scrollHeight;
        }
        fetchWaitlist();
      });

    function clearTerminal() {
      terminal.innerText = '';
    }

    async function runCommand(command, args = [], displayName = '') {
      try {
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command, args, displayName })
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'Failed to start execution');
        }
      } catch (err) {
        console.error(err);
        alert('Failed to contact server');
      }
    }

    async function killActiveProcess() {
      if (confirm('Are you sure you want to terminate the active operation?')) {
        await fetch('/api/kill', { method: 'POST' });
      }
    }

    function runGitSync() {
      const msg = document.getElementById('gitMessage').value.trim();
      if (!msg) return alert('Please enter a commit message.');
      runCommand('git-sync', [msg], 'Git Commit & Push');
    }

    function confirmResetIngest() {
      if (confirm('⚠️ Warning: Are you sure you want to reset all checkpoints and perform a full ingestion from scratch? This will rewrite historical catalogs.')) {
        runCommand('ingest', ['--reset'], 'Full Reset Ingestion');
      }
    }

    function runIngestWithLimit() {
      const limit = document.getElementById('ingestLimit').value;
      if (!limit || parseInt(limit) <= 0) return alert('Please input a valid limit size.');
      runCommand('ingest', ['--limit', limit], 'Ingest with Limit ' + limit);
    }

    function runEnrichWithLimit() {
      const limit = document.getElementById('enrichLimit').value;
      if (!limit || parseInt(limit) <= 0) return alert('Please input a valid limit size.');
      runCommand('enrich', ['--limit', limit], 'Enrich with Limit ' + limit);
    }

    function runItchSlug() {
      const slug = document.getElementById('itchSlug').value.trim();
      if (!slug) return alert('Please input a valid game slug.');
      runCommand('enrich-itch', ['--slug', slug], 'Enrich itch slug: ' + slug);
    }

    function runItchUrl() {
      const url = document.getElementById('itchUrl').value.trim();
      if (!url) return alert('Please input a valid itch page URL.');
      runCommand('enrich-itch', ['--url', url], 'Enrich itch url: ' + url);
    }

    function addCustomItchGame() {
      const title = document.getElementById('customItchTitle').value.trim();
      const url = document.getElementById('customItchUrl').value.trim();
      if (!title || !url) return alert('Please input both game title and itch url.');
      runCommand('add-custom-itch', [title, url], 'Add custom itch game: ' + title);
    }

    function runScareWithLimit() {
      const limit = document.getElementById('scareLimit').value;
      if (!limit || parseInt(limit) <= 0) return alert('Please input a valid limit size.');
      runCommand('scare', ['--limit', limit], 'Scare Enrichment limit ' + limit);
    }

    function runScareSlug() {
      const slug = document.getElementById('scareSlug').value.trim();
      if (!slug) return alert('Please input a game slug.');
      runCommand('scare', ['--slug', slug], 'Scare Enrichment slug: ' + slug);
    }

    function runScareTag() {
      const tag = document.getElementById('scareTag').value.trim();
      const limit = document.getElementById('scareTagLimit').value;
      if (!tag || !limit || parseInt(limit) <= 0) return alert('Please input both tag and limit.');
      runCommand('scare', ['--tag', tag, '--limit', limit], 'Scare tag enrichment: ' + tag + ' (' + limit + ')');
    }

    async function fetchWaitlist() {
      try {
        const res = await fetch('/api/admin/waitlist');
        if (res.ok) {
          const data = await res.json();
          renderWaitlist(data);
        } else {
          document.getElementById('waitlistContainer').innerHTML = '<div style="font-size: 0.8rem; color: var(--danger); text-align: center; padding: 1rem;">Failed to load waitlist.</div>';
        }
      } catch (e) {
        console.error("Fetch waitlist error:", e);
      }
    }

    function renderWaitlist(entries) {
      const container = document.getElementById('waitlistContainer');
      if (!entries || entries.length === 0) {
        container.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1rem;">No waitlist requests found.</div>';
        return;
      }

      container.innerHTML = '';
      entries.forEach(entry => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '0.5rem';
        item.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
        item.style.border = '1px solid var(--border-color)';
        item.style.borderRadius = '4px';

        let badgeClass = 'cron-badge';
        if (entry.status === 'APPROVED' || entry.status === 'SENT') {
          badgeClass = 'cron-badge success';
        }

        const dateStr = new Date(entry.createdAt).toLocaleDateString();

        item.innerHTML = \`
          <div style="display: flex; flex-direction: column; gap: 0.2rem;">
            <span style="font-size: 0.8rem; font-weight: bold; color: var(--text-main); word-break: break-all;">\${entry.email}</span>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="\${badgeClass}" style="font-size: 0.65rem;">\${entry.status}</span>
              <span style="font-size: 0.65rem; color: var(--text-muted);">\${dateStr}</span>
            </div>
          </div>
          <div>
            \${entry.status === 'PENDING' 
              ? '<button id="approve-btn-' + entry.id + '" class="btn btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;" onclick="approveEntry(\\'' + entry.id + '\\')">Approve</button>' 
              : entry.status === 'APPROVED' || entry.status === 'SENT'
                ? '<div style="display: flex; gap: 0.25rem;"><button id="revoke-btn-' + entry.id + '" class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;" onclick="revokeAccess(\\'' + entry.id + '\\')">Revoke</button><button id="resend-btn-' + entry.id + '" class="btn" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;" onclick="resendEmail(\\'' + entry.id + '\\')">Resend</button></div>'
                : '<button class="btn" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;" disabled>Approved</button>'
            }
          </div>
        \`;
        container.appendChild(item);
      });
    }

    async function approveEntry(id) {
      const btn = document.getElementById('approve-btn-' + id);
      if (btn) {
        btn.disabled = true;
        btn.innerText = 'Approving...';
      }
      try {
        const res = await fetch('/api/admin/waitlist/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (res.ok) {
          alert('User approved and email sent successfully!');
          fetchWaitlist();
        } else {
          alert('Failed to approve user: ' + (data.error || 'Unknown error'));
          if (btn) {
            btn.disabled = false;
            btn.innerText = 'Approve';
          }
        }
      } catch (e) {
        alert('Network error trying to approve user.');
        if (btn) {
          btn.disabled = false;
          btn.innerText = 'Approve';
        }
      }
    }

    async function revokeAccess(id) {
      const btn = document.getElementById('revoke-btn-' + id);
      if (btn) {
        btn.disabled = true;
        btn.innerText = 'Revoking...';
      }
      try {
        const res = await fetch('/api/admin/waitlist/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (res.ok) {
          alert('User access revoked successfully!');
          fetchWaitlist();
        } else {
          alert('Failed to revoke user access: ' + (data.error || 'Unknown error'));
          if (btn) {
            btn.disabled = false;
            btn.innerText = 'Revoke';
          }
        }
      } catch (e) {
        alert('Network error trying to revoke user access.');
        if (btn) {
          btn.disabled = false;
          btn.innerText = 'Revoke';
        }
      }
    }

    async function resendEmail(id) {
      const btn = document.getElementById('resend-btn-' + id);
      if (btn) {
        btn.disabled = true;
        btn.innerText = 'Resending...';
      }
      try {
        const res = await fetch('/api/admin/waitlist/resend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (res.ok) {
          alert('Email resent successfully!');
          fetchWaitlist();
        } else {
          alert('Failed to resend email: ' + (data.error || 'Unknown error'));
          if (btn) {
            btn.disabled = false;
            btn.innerText = 'Resend';
          }
        }
      } catch (e) {
        alert('Network error trying to resend email.');
        if (btn) {
          btn.disabled = false;
          btn.innerText = 'Resend';
        }
      }
    }
  </script>
</body>
</html>
`;

// Cookie parser helper
function getCookies(req: http.IncomingMessage) {
  const list: Record<string, string> = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      list[parts.shift()!.trim()] = decodeURI(parts.join("="));
    });
  }
  return list;
}

const PASSWORD = process.env.DEV_PORTAL_PASSWORD || "admin";

function getLoginHtmlContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - hoGAMEGATA Dev Portal</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0a0b0e;
      --bg-card: #12141a;
      --border-color: #212631;
      --text-main: #f3f4f6;
      --accent: #8b5cf6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-dark);
      font-family: 'Inter', sans-serif;
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      padding: 2.5rem;
      border-radius: 8px;
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { font-size: 0.9rem; color: #9ca3af; margin-bottom: 2rem; }
    input {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 0.75rem;
      color: var(--text-main);
      width: 100%;
      outline: none;
      margin-bottom: 1.5rem;
      text-align: center;
    }
    button {
      background: var(--accent);
      color: white;
      padding: 0.75rem;
      width: 100%;
      border: none;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }
    .error-msg {
      color: #ef4444;
      font-size: 0.85rem;
      margin-top: 1rem;
      display: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>Developer Portal</h2>
    <p>Please enter your access password</p>
    <input type="password" id="passwordInput" placeholder="Password" onkeydown="if(event.key==='Enter') login()">
    <button onclick="login()">Unlock Console</button>
    <div class="error-msg" id="errorMsg">Invalid credentials.</div>
  </div>
  <script>
    async function login() {
      const password = document.getElementById('passwordInput').value;
      const errorDiv = document.getElementById('errorMsg');
      errorDiv.style.display = 'none';
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        if (res.ok) {
          window.location.reload();
        } else {
          errorDiv.style.display = 'block';
        }
      } catch (e) {
        errorDiv.textContent = 'Connection error.';
        errorDiv.style.display = 'block';
      }
    }
  </script>
</body>
</html>
`;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host}`);

  // CORS Headers for strictly local requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const cookies = getCookies(req);
  const isAuthenticated = cookies.dev_session === PASSWORD;

  // 1. POST /api/login
  if (parsedUrl.pathname === "/api/login" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        if (payload.password === PASSWORD) {
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Set-Cookie": `dev_session=${PASSWORD}; Path=/; HttpOnly; SameSite=Strict`,
          });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid password" }));
        }
      } catch (err: any) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Auth Gate
  if (!isAuthenticated) {
    if (parsedUrl.pathname.startsWith("/api/")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(getLoginHtmlContent());
    return;
  }

  // 2. Live SSE stream
  if (parsedUrl.pathname === "/api/logs") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    sseClients.add(res);

    // Fetch maintenance status on SSE connect
    let maintenanceMode = false;
    try {
      const { db } = await import("../src/lib/db");
      const config = await db.systemConfig.findUnique({ where: { key: "maintenance_mode" } });
      maintenanceMode = config?.value === "true";
    } catch (e) {}

    // Write initial status payload immediately
    res.write(`data: ${JSON.stringify({ 
      type: "status", 
      status, 
      command: currentCommandName,
      maintenanceMode,
      cronJobs: cronJobs.map(c => ({
        id: c.id,
        name: c.name,
        enabled: c.enabled,
        lastRun: c.lastRun,
        lastStatus: c.lastStatus,
        nextRunTime: c.nextRunTime
      }))
    })}\n\n`);

    req.on("close", () => {
      sseClients.delete(res);
    });
    return;
  }

  // 3. Fetch status & cron settings & maintenance mode
  if (parsedUrl.pathname === "/api/status" && req.method === "GET") {
    let maintenanceMode = false;
    try {
      const { db } = await import("../src/lib/db");
      const config = await db.systemConfig.findUnique({
        where: { key: "maintenance_mode" }
      });
      maintenanceMode = config?.value === "true";
    } catch (e) {
      console.error("DB Maintenance check failed in API status:", e);
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status,
      command: currentCommandName,
      logBuffer,
      maintenanceMode,
      cronJobs: cronJobs.map(c => ({
        id: c.id,
        name: c.name,
        enabled: c.enabled,
        lastRun: c.lastRun,
        lastStatus: c.lastStatus,
        nextRunTime: c.nextRunTime
      }))
    }));
    return;
  }

  // 4. Toggle Maintenance Mode
  if (parsedUrl.pathname === "/api/maintenance/toggle" && req.method === "POST") {
    try {
      const { db } = await import("../src/lib/db");
      const config = await db.systemConfig.findUnique({
        where: { key: "maintenance_mode" }
      });
      const isMaintenance = config?.value === "true";
      const newValue = !isMaintenance;
      await db.systemConfig.upsert({
        where: { key: "maintenance_mode" },
        update: { value: String(newValue) },
        create: { key: "maintenance_mode", value: String(newValue) }
      });
      broadcastLog(`🛠️ [Portal] Maintenance mode set to: ${newValue ? "🔴 ON" : "🟢 OFF"}\n`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, enabled: newValue }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  // 5. Trigger manual action run
  if (parsedUrl.pathname === "/api/run" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { command, args, displayName } = payload;

        const scriptPath = SCRIPT_MAPPING[command];
        if (!scriptPath) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `Unknown command key: ${command}` }));
          return;
        }

        const success = startScript(scriptPath, args || [], displayName || command);
        if (success) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Started successfully" }));
        } else {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Another job is already running." }));
        }
      } catch (err: any) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON: " + err.message }));
      }
    });
    return;
  }

  // 6. Kill/Abort current task
  if (parsedUrl.pathname === "/api/kill" && req.method === "POST") {
    killCurrentProcess();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Termination signal dispatched" }));
    return;
  }

  // 7. Toggle Cron Enable/Disable
  if (parsedUrl.pathname === "/api/cron/toggle" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { id, enabled } = JSON.parse(body);
        const job = cronJobs.find(c => c.id === id);
        if (job) {
          job.enabled = enabled;
          if (enabled) {
            job.nextRunTime = Date.now() + job.intervalMs;
          }
          broadcastStatus();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Cron updated" }));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Job not found" }));
        }
      } catch (err: any) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 8. Force manual trigger of Cron Job
  if (parsedUrl.pathname === "/api/cron/run" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { id } = JSON.parse(body);
        const job = cronJobs.find(c => c.id === id);
        if (job) {
          const scriptPath = SCRIPT_MAPPING[job.command];
          if (scriptPath) {
            job.lastRun = new Date().toISOString();
            const success = startScript(scriptPath, job.args, `[Manual Scheduled] ${job.name}`, (code) => {
              job.lastStatus = code === 0 ? "success" : "failed";
              job.nextRunTime = Date.now() + job.intervalMs;
              broadcastStatus();
            });
            if (success) {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ message: "Job launched" }));
            } else {
              res.writeHead(409, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Another job is already running." }));
            }
          }
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Job not found" }));
        }
      } catch (err: any) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 8.1 Get waitlist
  if (parsedUrl.pathname === "/api/admin/waitlist" && req.method === "GET") {
    try {
      const { db } = await import("../src/lib/db");
      const list = await db.waitlist.findMany({
        orderBy: { createdAt: "desc" }
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(list));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  // 8.2 Approve waitlist entry
  if (parsedUrl.pathname === "/api/admin/waitlist/approve" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { id } = JSON.parse(body);
        if (!id) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing ID" }));
          return;
        }

        const { db } = await import("../src/lib/db");
        const entry = await db.waitlist.findUnique({
          where: { id }
        });

        if (!entry) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Waitlist entry not found" }));
          return;
        }

        // Determine if we are using Supabase Mode
        const isSupabaseMode = !!(
          process.env.NEXT_PUBLIC_SUPABASE_URL && 
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        let loginUrl = "";
        const hfSpaceUrl = process.env.SPACE_ID
          ? `https://${process.env.SPACE_ID.replace(/\/+/g, "-")}.hf.space`
          : undefined;
        const detectedUrl =
          process.env.NEXT_PUBLIC_SITE_URL ||
          hfSpaceUrl ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
        if (!detectedUrl) {
          throw new Error("No site URL configured. Set NEXT_PUBLIC_SITE_URL in .env to send emails.");
        }
        const siteUrl = detectedUrl.replace(/\/+$/, "");

        if (isSupabaseMode) {
          const { createClient } = await import("@supabase/supabase-js");
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // Generate magic link
          const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: entry.email,
            options: {
              redirectTo: `${siteUrl}/auth/callback`
            }
          });

          if (error) {
            throw new Error(`Supabase Admin Auth error: ${error.message}`);
          }

          loginUrl = data.properties.action_link;
        } else {
          // Mock Auth Mode
          loginUrl = `${siteUrl}/api/auth/token-login?token=${entry.token}`;
        }

        // Build email HTML
        const emailHtml = `
          <div style="font-family: monospace; background-color: #030303; color: #f3f4f6; padding: 40px; border: 4px solid #ffffff; max-width: 600px; margin: 0 auto; box-shadow: 8px 8px 0px 0px #ffffff;">
            <h1 style="font-family: sans-serif; font-weight: 900; font-size: 28px; text-transform: uppercase; margin-bottom: 20px; color: #ffffff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">Welcome to hoGAMEGATA</h1>
            <p style="font-size: 14px; line-height: 1.6; color: #9ca3af; margin-bottom: 24px;">
              Your request for early access has been approved! You can now log into the website.
            </p>
            <div style="background-color: #08080a; border: 1px solid rgba(255,255,255,0.2); padding: 20px; margin-bottom: 24px;">
              <span style="font-size: 11px; color: #ff2a2a; font-weight: bold; display: block; margin-bottom: 8px;">[ YOUR ACCESS INFO ]</span>
              <p style="font-size: 13px; color: #f3f4f6; margin: 0 0 10px 0;"><strong>Email:</strong> ${entry.email}</p>
              <a href="${loginUrl}" style="display: inline-block; background-color: #ffffff; color: #000000; padding: 12px 24px; font-size: 12px; font-weight: bold; text-decoration: none; text-transform: uppercase; border: 1px solid #ffffff;">[ Open hoGAMEGATA ]</a>
            </div>
            <p style="font-size: 11px; color: #4b5563; margin-top: 30px; text-transform: uppercase;">
              hoGAMEGATA Early Access
            </p>
          </div>
        `;

        // Send email using Resend
        const { Resend } = await import("resend");
        if (!process.env.RESEND_API_KEY) {
          throw new Error("RESEND_API_KEY environment variable is not configured.");
        }
        const resend = new Resend(process.env.RESEND_API_KEY);

        const { error: sendError } = await resend.emails.send({
          from: "hoGAMEGATA <noreply@gamegata.xyz>",
          to: [entry.email],
          subject: "[hoGAMEGATA] Early Access Granted",
          html: emailHtml,
        });

        if (sendError) {
          throw new Error(`Resend error: ${sendError.message}`);
        }

        // Update entry status in DB
        // If in Supabase mode, it's immediately active (SENT), otherwise it's APPROVED (pending first click)
        const nextStatus = isSupabaseMode ? "SENT" : "APPROVED";
        await db.waitlist.update({
          where: { id: entry.id },
          data: { status: nextStatus }
        });

        broadcastLog(`📧 [Portal] Approved waitlist request for ${entry.email} (Sent via Resend)\n`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err: any) {
        console.error("Approve waitlist entry error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || String(err) }));
      }
    });
    return;
  }

  // 8.3 Revoke waitlist access
  if (parsedUrl.pathname === "/api/admin/waitlist/revoke" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { id } = JSON.parse(body);
        if (!id) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing ID" }));
          return;
        }

        const { db } = await import("../src/lib/db");
        const entry = await db.waitlist.findUnique({
          where: { id }
        });

        if (!entry) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Waitlist entry not found" }));
          return;
        }

        if (entry.status !== "APPROVED" && entry.status !== "SENT") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Entry is not in an approved state" }));
          return;
        }

        // Update entry status to REVOKED
        await db.waitlist.update({
          where: { id: entry.id },
          data: { status: "REVOKED" }
        });

        broadcastLog(`🚫 [Portal] Revoked waitlist access for ${entry.email}\n`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err: any) {
        console.error("Revoke waitlist entry error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || String(err) }));
      }
    });
    return;
  }

  // 8.4 Resend waitlist email
  if (parsedUrl.pathname === "/api/admin/waitlist/resend" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { id } = JSON.parse(body);
        if (!id) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing ID" }));
          return;
        }

        const { db } = await import("../src/lib/db");
        const entry = await db.waitlist.findUnique({
          where: { id }
        });

        if (!entry) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Waitlist entry not found" }));
          return;
        }

        if (entry.status !== "APPROVED" && entry.status !== "SENT") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Entry is not in an approved state" }));
          return;
        }

        // Determine if we are using Supabase Mode
        const isSupabaseMode = !!(
          process.env.NEXT_PUBLIC_SUPABASE_URL && 
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        let loginUrl = "";
        const hfSpaceUrl = process.env.SPACE_ID
          ? `https://${process.env.SPACE_ID.replace(/\/+/g, "-")}.hf.space`
          : undefined;
        const detectedUrl =
          process.env.NEXT_PUBLIC_SITE_URL ||
          hfSpaceUrl ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
        if (!detectedUrl) {
          throw new Error("No site URL configured. Set NEXT_PUBLIC_SITE_URL in .env to send emails.");
        }
        const siteUrl = detectedUrl.replace(/\/+$/, "");

        if (isSupabaseMode) {
          const { createClient } = await import("@supabase/supabase-js");
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // Generate magic link
          const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: entry.email,
            options: {
              redirectTo: `${siteUrl}/auth/callback`
            }
          });

          if (error) {
            throw new Error(`Supabase Admin Auth error: ${error.message}`);
          }

          loginUrl = data.properties.action_link;
        } else {
          // Mock Auth Mode
          loginUrl = `${siteUrl}/api/auth/token-login?token=${entry.token}`;
        }

        // Build email HTML
        const emailHtml = `
          <div style="font-family: monospace; background-color: #030303; color: #f3f4f6; padding: 40px; border: 4px solid #ffffff; max-width: 600px; margin: 0 auto; box-shadow: 8px 8px 0px 0px #ffffff;">
            <h1 style="font-family: sans-serif; font-weight: 900; font-size: 28px; text-transform: uppercase; margin-bottom: 20px; color: #ffffff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">Welcome to hoGAMEGATA</h1>
            <p style="font-size: 14px; line-height: 1.6; color: #9ca3af; margin-bottom: 24px;">
              Your request for early access has been approved! You can now log into the website.
            </p>
            <div style="background-color: #08080a; border: 1px solid rgba(255,255,255,0.2); padding: 20px; margin-bottom: 24px;">
              <span style="font-size: 11px; color: #ff2a2a; font-weight: bold; display: block; margin-bottom: 8px;">[ YOUR ACCESS INFO ]</span>
              <p style="font-size: 13px; color: #f3f4f6; margin: 0 0 10px 0;"><strong>Email:</strong> ${entry.email}</p>
              <a href="${loginUrl}" style="display: inline-block; background-color: #ffffff; color: #000000; padding: 12px 24px; font-size: 12px; font-weight: bold; text-decoration: none; text-transform: uppercase; border: 1px solid #ffffff;">[ Open hoGAMEGATA ]</a>
            </div>
            <p style="font-size: 11px; color: #4b5563; margin-top: 30px; text-transform: uppercase;">
              hoGAMEGATA Early Access
            </p>
          </div>
        `;

        // Send email using Resend
        const { Resend } = await import("resend");
        if (!process.env.RESEND_API_KEY) {
          throw new Error("RESEND_API_KEY environment variable is not configured.");
        }
        const resend = new Resend(process.env.RESEND_API_KEY);

        const { error: sendError } = await resend.emails.send({
          from: "hoGAMEGATA <noreply@gamegata.xyz>",
          to: [entry.email],
          subject: "[hoGAMEGATA] Early Access Granted",
          html: emailHtml,
        });

        if (sendError) {
          throw new Error(`Resend error: ${sendError.message}`);
        }

        broadcastLog(`📧 [Portal] Resent approval email for ${entry.email} (Sent via Resend)\n`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err: any) {
        console.error("Resend waitlist email error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || String(err) }));
      }
    });
    return;
  }

  // 9. Default view: serve the Single Page Admin dashboard UI
  if (parsedUrl.pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(HTML_CONTENT);
    return;
  }

  // 404 fallback
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🖥  hoGAMEGATA UNIFIED DEVELOPER PORTAL GUI ACTIVE`);
  console.log(`📡 Access here: http://localhost:${PORT}`);
  console.log(`🔑 Login Password: ${PASSWORD}`);
  console.log(`==================================================\n`);
});
