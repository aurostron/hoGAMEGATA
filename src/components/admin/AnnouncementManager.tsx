import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, Trash2, Loader2, Calendar, Tag, Link as LinkIcon, AlertCircle, CheckCircle2, Megaphone } from 'lucide-react';

export interface Announcement {
  id: string;
  title: string;
  summary: string;
  version?: string | null;
  category: string;
  date: string | number | Date;
  linkUrl?: string | null;
  isPublished: boolean;
  createdAt: string;
}

export const AnnouncementManager: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [version, setVersion] = useState('v0.9.5');
  const [category, setCategory] = useState('changelog');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [linkUrl, setLinkUrl] = useState('');

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/announcements?limit=50');
      const data = await res.json();
      if (res.ok && data.success) {
        setAnnouncements(data.announcements || []);
      } else {
        setError(data.error || 'Failed to fetch announcements');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) {
      setError('Title and Summary are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim(),
          version: version.trim() || null,
          category,
          date: date ? new Date(date).toISOString() : new Date().toISOString(),
          linkUrl: linkUrl.trim() || null,
          isPublished: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish announcement');
      }

      setSuccessMsg(`✅ ${data.message || 'Announcement published!'}`);
      setTitle('');
      setSummary('');
      setLinkUrl('');
      fetchAnnouncements();
    } catch (err: any) {
      setError(err.message || 'An error occurred while publishing.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;

    setDeletingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/announcements?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete announcement');
      }

      setAnnouncements((prev) => prev.filter((item) => item.id !== id));
      setSuccessMsg('✅ Announcement deleted successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to delete announcement.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Create Announcement Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0e0e11] border border-white/15 shadow-2xl space-y-6">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20 text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Publish New Update / Announcement</h2>
            <p className="text-xs font-mono text-neutral-400">Post changelogs, feature releases, or system news for end-users</p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Title */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-white">
                Announcement Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Engine Update 0.9.5 — Improved Search & Dark Mode"
                className="w-full rounded-2xl bg-black border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none"
                required
              />
            </div>

            {/* Version */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-white">Version Tag</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g. v0.9.5"
                className="w-full rounded-2xl bg-black border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-white">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl bg-black border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white focus:outline-none"
              >
                <option value="changelog">Changelog</option>
                <option value="feature">New Feature</option>
                <option value="announcement">Announcement</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            {/* Customizable Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-white">Customizable Release Date</label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl bg-black border border-white/20 focus:border-white p-3 text-xs font-mono text-white focus:outline-none"
                required
              />
            </div>

            {/* Link URL */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-white">Link URL (Optional)</label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://gamegata.xyz/status"
                className="w-full rounded-2xl bg-black border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-white">
              Summary / Changelog Body <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Describe what changed, new features added, or key bug fixes..."
              className="w-full rounded-2xl bg-black border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none resize-none"
              required
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-2xl bg-white hover:bg-neutral-200 text-black font-extrabold text-xs transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Publish Update</span>
            </button>
          </div>
        </form>
      </div>

      {/* Existing Announcements Table */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0e0e11] border border-white/15 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20 text-white">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Published Announcements ({announcements.length})</h3>
              <p className="text-xs font-mono text-neutral-400">Manage active platform changelogs</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-neutral-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-white" />
            <p className="text-xs font-mono">Loading announcements...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 font-mono text-xs">
            No announcements found in database.
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 rounded-2xl bg-black border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded border border-white/20 bg-white/10 text-white text-[10px] font-mono font-bold uppercase">
                      {item.category}
                    </span>
                    {item.version && (
                      <span className="text-[10px] font-mono text-neutral-300 font-bold px-1.5 py-0.5 rounded bg-white/10 border border-white/15">
                        {item.version}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-neutral-500">
                      {new Date(item.date).toLocaleString()}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white">{item.title}</h4>
                  <p className="text-xs text-neutral-300 font-sans line-clamp-2">{item.summary}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 self-start sm:self-center"
                >
                  {deletingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
