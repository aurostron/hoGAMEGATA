import React, { useState, useEffect, useRef } from 'react';
import { Bell, Sparkles, ExternalLink, CheckCheck, Loader2, Megaphone, History, X } from 'lucide-react';

export interface AnnouncementItem {
  id: string;
  title: string;
  summary: string;
  version?: string | null;
  category: 'changelog' | 'announcement' | 'feature' | 'maintenance' | string;
  date: string | number | Date;
  linkUrl?: string | null;
}

const STORAGE_KEY = 'gg_last_read_announcement_date';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Check unread badge state from localStorage without making any network requests
  useEffect(() => {
    try {
      const lastRead = localStorage.getItem(STORAGE_KEY);
      if (!lastRead) {
        setHasUnread(true);
      } else {
        // If lastRead exists, compare against stored timestamp
        const lastReadTime = new Date(lastRead).getTime();
        if (Date.now() - lastReadTime > 7 * 24 * 60 * 60 * 1000) {
          // If older than 7 days, show subtle hint dot
          setHasUnread(true);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Handle outside click & escape key to close popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Fetch announcements on-click ONLY (lazy load)
  const fetchAnnouncements = async () => {
    if (fetched && announcements.length > 0) return; // Client-side memory cache check

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/announcements?limit=20');
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load updates');
      }

      const items: AnnouncementItem[] = data.announcements || [];
      setAnnouncements(items);
      setFetched(true);

      // Check unread against the latest item date
      if (items.length > 0) {
        const latestDate = new Date(items[0].date).getTime();
        const lastRead = localStorage.getItem(STORAGE_KEY);
        if (!lastRead || new Date(lastRead).getTime() < latestDate) {
          setHasUnread(true);
        } else {
          setHasUnread(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Unable to fetch updates');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState) {
      fetchAnnouncements();
    }
  };

  const handleMarkAllRead = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      setHasUnread(false);
    } catch {}
  };

  const formatDate = (dateStr: string | number | Date) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category.toLowerCase()) {
      case 'feature':
        return { label: 'New Feature', class: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' };
      case 'changelog':
        return { label: 'Changelog', class: 'bg-white/10 text-white border-white/20' };
      case 'announcement':
        return { label: 'Announcement', class: 'bg-purple-500/10 text-purple-300 border-purple-500/20' };
      case 'maintenance':
        return { label: 'Maintenance', class: 'bg-amber-500/10 text-amber-300 border-amber-500/20' };
      default:
        return { label: category, class: 'bg-white/10 text-white border-white/20' };
    }
  };

  return (
    <div ref={containerRef} className="relative flex items-center justify-center">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center justify-center font-mono text-xs text-white hover:bg-white/10 transition-all duration-150 w-10 h-10 sm:w-11 sm:h-11 rounded-xl font-bold cursor-pointer bg-transparent relative select-none"
        title="Version Updates & Announcements"
        aria-label="Version updates and announcements"
      >
        <Bell className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-white/90 transition-transform active:scale-95" />
        
        {/* Unread Badge Dot */}
        {hasUnread && (
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-white ring-2 ring-black animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[420px] bg-[#0e0e11] border border-white/15 rounded-3xl shadow-2xl overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/10 border border-white/20 text-white">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  What's New
                  <span className="text-[10px] font-mono text-neutral-400 font-normal px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                    beta v0.9.0
                  </span>
                </h3>
                <p className="text-[11px] font-mono text-neutral-400">Updates, fixes & platform changelogs</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleMarkAllRead}
                title="Mark all as read"
                className="p-1.5 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="py-12 text-center text-neutral-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-white" />
                <p className="text-xs font-mono">Loading announcements...</p>
              </div>
            ) : error ? (
              <div className="py-8 text-center text-red-400 text-xs font-mono space-y-1">
                <p>⚠️ {error}</p>
                <button
                  type="button"
                  onClick={fetchAnnouncements}
                  className="mt-2 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : announcements.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 space-y-2">
                <Megaphone className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-xs font-mono">No updates posted yet.</p>
              </div>
            ) : (
              announcements.map((item) => {
                const badge = getCategoryBadge(item.category);
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 transition-all duration-150 space-y-2 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold uppercase tracking-wider ${badge.class}`}>
                          {badge.label}
                        </span>
                        {item.version && (
                          <span className="text-[10px] font-mono text-neutral-300 font-bold px-1.5 py-0.5 rounded bg-white/10 border border-white/15">
                            {item.version}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-neutral-500 shrink-0">
                        {formatDate(item.date)}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white group-hover:text-white transition-colors leading-snug">
                      {item.title}
                    </h4>

                    <p className="text-xs text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap">
                      {item.summary}
                    </p>

                    {item.linkUrl && (
                      <a
                        href={item.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-300 hover:text-white transition-colors pt-1 font-semibold"
                      >
                        <span>Learn more</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-white/10 bg-white/[0.01] flex items-center justify-between text-[11px] font-mono text-neutral-500">
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              <span>hoGAMEGATA Engine</span>
            </span>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-neutral-400 hover:text-white font-semibold transition-colors cursor-pointer"
            >
              Mark read
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
