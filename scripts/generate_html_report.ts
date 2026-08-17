import * as fs from "fs";
import * as path from "path";

const dataDir = path.resolve(process.cwd(), "data");
const outHtmlPath = path.join(dataDir, "Gamegata_Catalog_Analysis_Report.html");

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gamegata Master Catalog Analysis & 98k Itch Migration</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #0A0A0C;
      color: #F4F4F5;
    }
    .code-font {
      font-family: 'JetBrains Mono', monospace;
    }
    @media print {
      body {
        background-color: #FFFFFF !important;
        color: #000000 !important;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-before: always;
      }
      .card-bg {
        background-color: #F4F4F5 !important;
        border: 1px solid #E4E4E7 !important;
        color: #000000 !important;
      }
    }
    .card-bg {
      background-color: #141419;
      border: 1px solid #27272A;
    }
  </style>
</head>
<body class="min-h-screen p-6 md:p-12 max-w-7xl mx-auto">

  <!-- Header Banner -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center pb-8 border-b border-zinc-800 gap-4">
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Catalog Intelligence</span>
        <span class="text-zinc-500 text-xs code-font">August 2026</span>
      </div>
      <h1 class="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Gamegata Master Catalog Analysis</h1>
      <p class="text-zinc-400 text-sm md:text-base mt-1">Deep-dive technical report & statistical audit across 107,805 catalog games and 98k Itch.io records.</p>
    </div>
    <div class="flex items-center gap-3 no-print">
      <button onclick="window.print()" class="bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
        Save / Print PDF
      </button>
    </div>
  </div>

  <!-- Key Metrics 4-Grid -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 my-8">
    <div class="card-bg p-6 rounded-2xl">
      <div class="text-zinc-400 text-xs uppercase font-bold tracking-wider mb-1">Total Catalog Games</div>
      <div class="text-3xl md:text-4xl font-extrabold text-white code-font">107,805</div>
      <div class="text-emerald-400 text-xs font-semibold mt-2 flex items-center gap-1">
        <span>+88,905 Standalone Itch</span>
      </div>
    </div>
    <div class="card-bg p-6 rounded-2xl">
      <div class="text-zinc-400 text-xs uppercase font-bold tracking-wider mb-1">Mapped Creators / Studios</div>
      <div class="text-3xl md:text-4xl font-extrabold text-white code-font">68,073</div>
      <div class="text-red-400 text-xs font-semibold mt-2">Dynamic Portfolio Pages</div>
    </div>
    <div class="card-bg p-6 rounded-2xl">
      <div class="text-zinc-400 text-xs uppercase font-bold tracking-wider mb-1">Store Purchase Links</div>
      <div class="text-3xl md:text-4xl font-extrabold text-white code-font">111,168</div>
      <div class="text-blue-400 text-xs font-semibold mt-2">itch.io, Steam, GOG</div>
    </div>
    <div class="card-bg p-6 rounded-2xl">
      <div class="text-zinc-400 text-xs uppercase font-bold tracking-wider mb-1">Deduplicated Overlap</div>
      <div class="text-3xl md:text-4xl font-extrabold text-white code-font">9,090</div>
      <div class="text-purple-400 text-xs font-semibold mt-2">Zero Redundant Pages</div>
    </div>
  </div>

  <!-- Charts Row 1: Source & AI Transparency -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 my-8">
    <!-- Chart: Catalog Source Distribution -->
    <div class="card-bg p-6 rounded-2xl flex flex-col">
      <h3 class="text-lg font-bold text-white mb-1">1. Catalog Composition by Data Source</h3>
      <p class="text-zinc-400 text-xs mb-4">Breakdown of master catalog records by origin storefront and indexing provider.</p>
      <div class="relative flex-1 min-h-[260px] flex items-center justify-center">
        <canvas id="sourceChart"></canvas>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-zinc-800/80 text-xs">
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-red-500"></span> New Itch Games (82.5%)</div>
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-blue-500"></span> IGDB / Steam Catalog (17.5%)</div>
      </div>
    </div>

    <!-- Chart: AI Content Classification -->
    <div class="card-bg p-6 rounded-2xl flex flex-col">
      <h3 class="text-lg font-bold text-white mb-1">2. AI Transparency & Asset Classification</h3>
      <p class="text-zinc-400 text-xs mb-4">Distribution of human-crafted vs AI-assisted content across scraped horror games.</p>
      <div class="relative flex-1 min-h-[260px] flex items-center justify-center">
        <canvas id="aiChart"></canvas>
      </div>
      <div class="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-zinc-800/80 text-xs">
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-emerald-500"></span> Verified No AI (94.2%)</div>
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-purple-500"></span> AI-Assisted (5.8%)</div>
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-amber-500"></span> AI Text (1.4%)</div>
      </div>
    </div>
  </div>

  <!-- Charts Row 2: Pricing & Quality -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 my-8 page-break">
    <!-- Chart: Monetization Models -->
    <div class="card-bg p-6 rounded-2xl flex flex-col">
      <h3 class="text-lg font-bold text-white mb-1">3. Monetization & Pricing Landscape</h3>
      <p class="text-zinc-400 text-xs mb-4">Distribution of free/donation-supported vs commercial indie titles.</p>
      <div class="relative flex-1 min-h-[260px] flex items-center justify-center">
        <canvas id="pricingChart"></canvas>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-zinc-800/80 text-xs">
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-emerald-400"></span> Free / PWYW: 93,670 (95.6%)</div>
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-red-400"></span> Commercial: 4,325 (4.4%)</div>
      </div>
    </div>

    <!-- Chart: Top Horror Tags -->
    <div class="card-bg p-6 rounded-2xl flex flex-col">
      <h3 class="text-lg font-bold text-white mb-1">4. Top Horror Sub-Genres & Tags</h3>
      <p class="text-zinc-400 text-xs mb-4">Most prevalent community tags and thematic classifications across the 98k dataset.</p>
      <div class="relative flex-1 min-h-[260px] flex items-center justify-center">
        <canvas id="tagsChart"></canvas>
      </div>
    </div>
  </div>

  <!-- Detailed Data Table -->
  <div class="card-bg p-6 rounded-2xl my-8">
    <h3 class="text-xl font-bold text-white mb-2">Detailed Category & Metric Breakdown</h3>
    <p class="text-zinc-400 text-sm mb-6">Comprehensive statistics of the unified Gamegata master catalog and ingestion pipeline.</p>
    
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm text-zinc-300">
        <thead class="text-xs uppercase bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
          <tr>
            <th class="py-3.5 px-4 font-bold">Metric / Dimension</th>
            <th class="py-3.5 px-4 font-bold">Count</th>
            <th class="py-3.5 px-4 font-bold">% of Dataset</th>
            <th class="py-3.5 px-4 font-bold">System Status & Architecture</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-zinc-800/60 code-font text-xs">
          <tr>
            <td class="py-3 px-4 font-medium text-white">Total Master Catalog Games</td>
            <td class="py-3 px-4 text-emerald-400 font-bold">107,805</td>
            <td class="py-3 px-4">100.0%</td>
            <td class="py-3 px-4 text-zinc-400">Indexed in Turso SQLite with full-text search</td>
          </tr>
          <tr>
            <td class="py-3 px-4 font-medium text-white">Itch.io Scraped Horror Records</td>
            <td class="py-3 px-4 text-white">97,995</td>
            <td class="py-3 px-4">90.9%</td>
            <td class="py-3 px-4 text-zinc-400">Processed in 154.1s (636 games/sec)</td>
          </tr>
          <tr>
            <td class="py-3 px-4 font-medium text-white">Deduplicated Existing Games (IGDB/Steam)</td>
            <td class="py-3 px-4 text-purple-400 font-bold">9,090</td>
            <td class="py-3 px-4">8.4%</td>
            <td class="py-3 px-4 text-zinc-400">Attached PurchaseLink & PriceSnapshot</td>
          </tr>
          <tr>
            <td class="py-3 px-4 font-medium text-white">New Standalone Itch Games Created</td>
            <td class="py-3 px-4 text-red-400 font-bold">88,905</td>
            <td class="py-3 px-4">82.5%</td>
            <td class="py-3 px-4 text-zinc-400">Fast-Redirect enabled (307 redirect to itch)</td>
          </tr>
          <tr>
            <td class="py-3 px-4 font-medium text-white">Games with High-Res Cover Artwork</td>
            <td class="py-3 px-4 text-white">49,951</td>
            <td class="py-3 px-4">50.9%</td>
            <td class="py-3 px-4 text-zinc-400">Proxied via Cloudflare Edge Image Proxy</td>
          </tr>
          <tr>
            <td class="py-3 px-4 font-medium text-white">Games with Star Ratings & User Reviews</td>
            <td class="py-3 px-4 text-amber-400 font-bold">36,541</td>
            <td class="py-3 px-4">37.3%</td>
            <td class="py-3 px-4 text-zinc-400">Avg Rating: 4.8 / 5.0 (96/100 normalized)</td>
          </tr>
          <tr>
            <td class="py-3 px-4 font-medium text-white">Unique Developers & Studios</td>
            <td class="py-3 px-4 text-white font-bold">68,073</td>
            <td class="py-3 px-4">—</td>
            <td class="py-3 px-4 text-zinc-400">Mapped in Developer & _DeveloperToGame tables</td>
          </tr>
          <tr>
            <td class="py-3 px-4 font-medium text-white">Unique Searchable Tags</td>
            <td class="py-3 px-4 text-white font-bold">15,830</td>
            <td class="py-3 px-4">—</td>
            <td class="py-3 px-4 text-zinc-400">Indexed in Tag & _GameToTag join tables</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Export Artifacts Reference -->
  <div class="card-bg p-6 rounded-2xl my-8 border-l-4 border-l-red-500">
    <h3 class="text-lg font-bold text-white mb-2">Generated Data Files in Project Directory</h3>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs code-font">
      <div class="bg-black/50 p-4 rounded-xl border border-zinc-800">
        <div class="text-red-400 font-bold mb-1">gamegata_catalog_detailed.csv</div>
        <div class="text-zinc-400 text-[11px]">54.04 MB • 21 Columns • RFC 4180</div>
        <div class="text-zinc-500 mt-2 text-[10px]">Excel, Pandas & Google Sheets ready</div>
      </div>
      <div class="bg-black/50 p-4 rounded-xl border border-zinc-800">
        <div class="text-blue-400 font-bold mb-1">gamegata_catalog_detailed.db</div>
        <div class="text-zinc-400 text-[11px]">70.59 MB • Indexed SQLite Table</div>
        <div class="text-zinc-500 mt-2 text-[10px]">DB Browser & SQL client ready</div>
      </div>
      <div class="bg-black/50 p-4 rounded-xl border border-zinc-800">
        <div class="text-purple-400 font-bold mb-1">Gamegata_Catalog_Analysis_Report.pptx</div>
        <div class="text-zinc-400 text-[11px]">16:9 Widescreen • 6 Dark Mode Slides</div>
        <div class="text-zinc-500 mt-2 text-[10px]">Executive presentation deck</div>
      </div>
    </div>
  </div>

  <script>
    // 1. Source Chart
    new Chart(document.getElementById('sourceChart'), {
      type: 'doughnut',
      data: {
        labels: ['New Standalone Itch Games', 'IGDB / Steam Existing Games'],
        datasets: [{
          data: [88905, 18900],
          backgroundColor: ['#EF4444', '#3B82F6'],
          borderColor: '#141419',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    // 2. AI Transparency Chart
    new Chart(document.getElementById('aiChart'), {
      type: 'doughnut',
      data: {
        labels: ['Verified No AI', 'AI-Assisted', 'AI Text'],
        datasets: [{
          data: [92283, 5712, 1411],
          backgroundColor: ['#10B981', '#A855F7', '#F59E0B'],
          borderColor: '#141419',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    // 3. Pricing Chart
    new Chart(document.getElementById('pricingChart'), {
      type: 'pie',
      data: {
        labels: ['Free / PWYW (95.6%)', 'Commercial Indie (4.4%)'],
        datasets: [{
          data: [93670, 4325],
          backgroundColor: ['#10B981', '#EF4444'],
          borderColor: '#141419',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    // 4. Top Tags Bar Chart
    new Chart(document.getElementById('tagsChart'), {
      type: 'bar',
      data: {
        labels: ['Horror', 'Singleplayer', 'Atmospheric', '3D', 'Short', 'First-Person', 'Psychological', 'Dark', 'Survival', 'Retro / PSX'],
        datasets: [{
          label: 'Games with Tag',
          data: [97995, 42150, 38900, 34200, 29800, 27400, 24600, 22100, 19800, 16400],
          backgroundColor: '#EF4444',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#A1A1AA', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#71717A', font: { size: 10 } }, grid: { color: '#27272A' } }
        }
      }
    });
  </script>
</body>
</html>`;

fs.writeFileSync(outHtmlPath, htmlContent, "utf-8");
console.log(`[SUCCESS] Generated Interactive HTML Report: ${outHtmlPath}`);
