import React, { useState, useEffect } from 'react';

interface MirrorGatewayProps {
  primaryUrl?: string;
  autoForwardDelay?: number; // seconds
}

type NodeStatus = 'probing' | 'online' | 'offline';

export default function MirrorGateway({
  primaryUrl = 'https://gamegata.xyz',
  autoForwardDelay = 4,
}: MirrorGatewayProps) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [status, setStatus] = useState<NodeStatus>('probing');
  const [countdown, setCountdown] = useState(autoForwardDelay);
  const [autoForwardActive, setAutoForwardActive] = useState(true);

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    // Check if user already acknowledged or bypassed in this session
    const acknowledged = sessionStorage.getItem('hgg_mirror_acknowledged');
    const isPrimary = window.location.hostname === 'gamegata.xyz' || window.location.hostname.endsWith('.gamegata.xyz');

    // Do not show on primary domain or if already acknowledged
    if (acknowledged || isPrimary) {
      return;
    }

    // Show gateway
    setVisible(true);

    let cancelled = false;

    // Fast reachability check to gamegata.xyz
    const checkPrimary = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2200);

        const res = await fetch(`${primaryUrl}/api/status`, {
          method: 'GET',
          mode: 'cors',
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });

        clearTimeout(timeoutId);

        if (!cancelled) {
          if (res.ok) {
            setStatus('online');
          } else {
            setStatus('offline');
          }
        }
      } catch (e) {
        // Fallback probe: try HEAD on static favicon
        try {
          const fbController = new AbortController();
          const fbTimeoutId = setTimeout(() => fbController.abort(), 1500);

          await fetch(`${primaryUrl}/favicon.ico?_t=${Date.now()}`, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: fbController.signal,
          });

          clearTimeout(fbTimeoutId);
          if (!cancelled) setStatus('online');
        } catch {
          if (!cancelled) setStatus('offline');
        }
      }
    };

    checkPrimary();

    return () => {
      cancelled = true;
    };
  }, [primaryUrl]);

  // Handle countdown if primary is online
  useEffect(() => {
    if (status !== 'online' || !autoForwardActive) return;

    if (countdown <= 0) {
      // Forward to primary
      window.location.href = primaryUrl;
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [status, countdown, autoForwardActive, primaryUrl]);

  // Handle auto-proceed into mirror if primary is offline
  useEffect(() => {
    if (status !== 'offline') return;

    // If offline, wait 1.2s to show status then seamlessly fade into mirror
    const timer = setTimeout(() => {
      dismissGateway();
    }, 1200);

    return () => clearTimeout(timer);
  }, [status]);

  const dismissGateway = () => {
    setAutoForwardActive(false);
    setFading(true);
    try {
      sessionStorage.setItem('hgg_mirror_acknowledged', '1');
    } catch {}

    setTimeout(() => {
      setVisible(false);
    }, 600);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col justify-between bg-black text-white selection:bg-white selection:text-black font-sans transition-opacity duration-600 ease-out ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: '#000000',
      }}
    >
      {/* Top Header */}
      <header className="w-full px-8 md:px-16 pt-12 md:pt-16 flex justify-between items-center text-[11px] md:text-xs tracking-widest uppercase text-neutral-500 font-mono">
        <span className="font-sans font-bold text-white tracking-tight text-sm">hoGAMEGATA</span>
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              status === 'probing'
                ? 'bg-amber-400 animate-pulse'
                : status === 'online'
                ? 'bg-emerald-400'
                : 'bg-neutral-600'
            }`}
          />
          <span>{status === 'probing' ? 'Checking connection...' : status === 'online' ? 'Main site online' : 'Main site offline'}</span>
        </div>
      </header>

      {/* Center Minimalist Body */}
      <main className="w-full max-w-2xl mx-auto px-8 md:px-16 py-12 flex flex-col items-start justify-center">
        <h1 className="text-3xl md:text-4xl font-light tracking-tight text-white mb-4 leading-tight">
          {status === 'probing' && 'Checking main site availability...'}
          {status === 'online' && 'Gamegata is online.'}
          {status === 'offline' && 'Viewing offline catalog.'}
        </h1>

        <p className="text-sm md:text-base font-normal text-neutral-400 max-w-lg leading-relaxed mb-10">
          {status === 'probing' &&
            'Testing connection to gamegata.xyz...'}
          {status === 'online' &&
            'The main site is available with user accounts, collections, and reviews. You can head there now or keep browsing this backup.'}
          {status === 'offline' &&
            'The main site is currently unreachable. You can continue searching and browsing the offline backup library.'}
        </p>

        {/* Action Controls */}
        {status === 'online' && (
          <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <a
              href={primaryUrl}
              className="px-6 py-3.5 border border-white bg-white text-black text-xs font-semibold tracking-wider uppercase text-center hover:bg-transparent hover:text-white transition-colors duration-200"
            >
              Go to gamegata.xyz ({countdown}s)
            </a>

            <button
              type="button"
              onClick={dismissGateway}
              className="px-6 py-3.5 border border-neutral-700 text-neutral-300 text-xs font-semibold tracking-wider uppercase hover:border-neutral-400 hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Stay on backup
            </button>
          </div>
        )}

        {status === 'offline' && (
          <button
            type="button"
            onClick={dismissGateway}
            className="px-6 py-3.5 border border-white bg-white text-black text-xs font-semibold tracking-wider uppercase hover:bg-transparent hover:text-white transition-colors duration-200 cursor-pointer"
          >
            Browse Offline Catalog
          </button>
        )}

        {status === 'probing' && (
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <div className="w-2 h-2 bg-neutral-400 rounded-full animate-ping" />
            <span>Connecting to gamegata.xyz...</span>
          </div>
        )}
      </main>

      {/* Bottom Minimalist Footer */}
      <footer className="w-full px-8 md:px-16 pb-12 md:pb-16 flex justify-end items-center text-xs text-neutral-500">
        {status === 'online' && autoForwardActive && (
          <button
            type="button"
            onClick={() => setAutoForwardActive(false)}
            className="text-neutral-400 hover:text-white transition-colors cursor-pointer text-xs"
          >
            Cancel auto-redirect
          </button>
        )}
      </footer>
    </div>
  );
}
