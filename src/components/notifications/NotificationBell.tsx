import React, { useState, useEffect, useRef } from 'react';
import { Bell, ExternalLink, Loader2, X, ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';

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
const ITEMS_PER_PAGE = 4;

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Check unread badge state from localStorage
  useEffect(() => {
    try {
      const lastRead = localStorage.getItem(STORAGE_KEY);
      if (!lastRead) {
        setHasUnread(true);
      } else {
        const lastReadTime = new Date(lastRead).getTime();
        if (Date.now() - lastReadTime > 7 * 24 * 60 * 60 * 1000) {
          setHasUnread(true);
        }
      }
    } catch {}
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

  // Fetch announcements dynamically from Turso DB on-click
  const fetchAnnouncements = async () => {
    if (fetched && announcements.length > 0) return;

    setLoading(true);
    try {
      const res = await fetch('/api/announcements?limit=50');
      const data = await res.json();

      if (res.ok && data.success && Array.isArray(data.announcements)) {
        setAnnouncements(data.announcements);
        setFetched(true);
      }
    } catch (err) {
      console.error('Failed to fetch announcements from database:', err);
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

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(announcements.length / ITEMS_PER_PAGE));
  const paginatedItems = announcements.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div ref={containerRef} className="relative flex items-center justify-center">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center justify-center font-mono text-xs text-white hover:bg-white/10 transition-all duration-150 w-10 h-10 sm:w-11 sm:h-11 rounded-xl font-bold cursor-pointer bg-transparent relative select-none"
        title="Updates"
        aria-label="Updates"
      >
        <Bell className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-white/90 transition-transform active:scale-95" />
        
        {/* Unread Badge Dot */}
        {hasUnread && (
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-white ring-2 ring-black animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[400px] bg-[#0e0e11] border border-white/15 rounded-3xl shadow-2xl overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <h3 className="text-base font-bold text-white tracking-tight">
              Updates
            </h3>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List Content */}
          <div className="min-h-[280px] max-h-[360px] overflow-y-auto p-4 space-y-3">
            {loading && announcements.length === 0 ? (
              <div className="py-16 text-center text-neutral-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-white" />
                <p className="text-xs font-mono">Loading updates from DB...</p>
              </div>
            ) : announcements.length === 0 ? (
              <div className="py-16 text-center text-neutral-500 space-y-2">
                <Megaphone className="w-8 h-8 mx-auto opacity-30" />
                <p className="text-xs font-mono">No updates posted yet.</p>
              </div>
            ) : (
              paginatedItems.map((item) => {
                const badge = getCategoryBadge(item.category);
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 transition-all duration-150 space-y-1.5 group"
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

                    <h4 className="text-xs font-bold text-white leading-snug">
                      {item.title}
                    </h4>

                    <p className="text-xs text-neutral-300 leading-relaxed font-sans">
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

          {/* Footer & Pagination */}
          <div className="px-5 py-3 border-t border-white/10 bg-white/[0.01] flex items-center justify-between text-[11px] font-mono text-neutral-400">
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-neutral-400 hover:text-white font-semibold transition-colors cursor-pointer"
            >
              Mark all read
            </button>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-white font-bold">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
