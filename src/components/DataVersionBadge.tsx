import React, { useState, useEffect } from 'react';
import type { DataVersionInfo } from '../lib/dataVersion';

interface DataVersionBadgeProps {
  initialVersion: DataVersionInfo;
}

const STORAGE_KEY = 'gata_data_version_v1';
const CACHE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

function formatDisplayDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'recently';

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getUTCMonth()];
    const day = date.getUTCDate();
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');

    return `${month} ${day}, ${hours}:${minutes} UTC`;
  } catch {
    return 'recently';
  }
}

export default function DataVersionBadge({ initialVersion }: DataVersionBadgeProps) {
  const [version, setVersion] = useState<DataVersionInfo>(initialVersion);

  useEffect(() => {
    let isMounted = true;

    // 1. Check sessionStorage cache first (0 network hits)
    try {
      const cachedRaw = sessionStorage.getItem(STORAGE_KEY);
      if (cachedRaw) {
        const { version: cachedVer, timestamp } = JSON.parse(cachedRaw);
        if (cachedVer && timestamp && Date.now() - timestamp < CACHE_MAX_AGE_MS) {
          if (cachedVer.commitSha !== initialVersion.commitSha) {
            setVersion(cachedVer);
          }
          return;
        }
      }
    } catch {}

    // 2. Direct client fetch to GitHub CDN (CORS-enabled, 0 Cloudflare Worker hits)
    const fetchLiveVersion = async () => {
      const endpoints = [
        `https://raw.githubusercontent.com/project-hgg/project-hgg.github.io/main/docs/public/data-version.json?t=${Date.now()}`,
        `https://cdn.jsdelivr.net/gh/project-hgg/project-hgg.github.io@main/docs/public/data-version.json?t=${Date.now()}`,
      ];

      for (const url of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (data && data.commitSha && isMounted) {
              const fullSha = data.fullSha || data.commitSha;
              const date = data.timestamp || initialVersion.date;
              const liveVersion: DataVersionInfo = {
                commitSha: data.commitSha,
                fullSha,
                commitUrl: `https://github.com/project-hgg/project-hgg.github.io/commit/${fullSha}`,
                commitMessage: data.commitMessage || 'Catalog update',
                date,
                displayDate: formatDisplayDate(date),
                totalGames: data.totalGames || initialVersion.totalGames,
              };

              setVersion(liveVersion);

              try {
                sessionStorage.setItem(
                  STORAGE_KEY,
                  JSON.stringify({ version: liveVersion, timestamp: Date.now() })
                );
              } catch {}
              return;
            }
          }
        } catch {}
      }
    };

    fetchLiveVersion();

    return () => {
      isMounted = false;
    };
  }, [initialVersion]);

  return (
    <div className="flex items-center gap-2.5">
      <a
        href="https://github.com/project-hgg/project-hgg.github.io"
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/60 hover:text-white transition-all hover:scale-110 flex items-center justify-center p-1 rounded-md hover:bg-white/10 shrink-0"
        title="View project-hgg GitHub Repository"
        aria-label="GitHub Repository"
      >
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          />
        </svg>
      </a>
      <span className="text-white/40 uppercase text-[10.5px] font-semibold tracking-wider">Data</span>
      <a
        href={version.commitUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/80 hover:text-white font-medium hover:underline transition-colors"
        title={
          version.commitMessage
            ? `Commit ${version.commitSha}: ${version.commitMessage}`
            : `View data release commit ${version.commitSha} on GitHub`
        }
      >
        {version.commitSha}
      </a>
      <span className="text-white/20">/</span>
      <span className="text-white/40 text-[11.5px]">
        Updated {version.displayDate}
      </span>
    </div>
  );
}
