import React, { useState, useEffect } from 'react';

interface ServiceStatus {
  status: 'ONLINE' | 'OFFLINE';
  latency?: number;
}

interface StatusData {
  webApp?: ServiceStatus;
  database?: ServiceStatus;
  cdn?: ServiceStatus;
  catalogApi?: ServiceStatus;
  statsApi?: ServiceStatus;
}

export default function SystemStatusIndicator() {
  const [statusState, setStatusState] = useState<'operational' | 'degraded' | 'outage'>('operational');
  const [statusText, setStatusText] = useState('All systems operational');

  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const data: StatusData = await res.json();
        
        if (!isMounted) return;

        const services = [data.webApp, data.database, data.cdn, data.catalogApi, data.statsApi].filter(Boolean);
        if (services.length === 0) return;

        const onlineCount = services.filter((s) => s?.status === 'ONLINE').length;

        if (onlineCount === services.length) {
          setStatusState('operational');
          setStatusText('All systems operational');
        } else if (onlineCount === 0) {
          setStatusState('outage');
          setStatusText('All systems down');
        } else {
          setStatusState('degraded');
          setStatusText('Some systems degraded');
        }
      } catch (e) {
        // Retain optimistic default on transient network or adblock error
      }
    }

    checkStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const dotColor =
    statusState === 'operational'
      ? 'bg-emerald-500'
      : statusState === 'degraded'
      ? 'bg-amber-400'
      : 'bg-red-500';

  return (
    <a
      href="/status"
      className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors duration-150 group cursor-pointer w-fit py-0.5"
      aria-label={`System status: ${statusText}`}
      title="View live system status"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
      <span className="font-normal">{statusText}</span>
    </a>
  );
}
