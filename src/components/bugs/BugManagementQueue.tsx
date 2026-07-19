import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, CheckCircle2, Loader2, ExternalLink, Mail, Clock, Check, X } from 'lucide-react';

interface BugReportItem {
  id: string;
  ticketId: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  pageUrl: string;
  userAgent?: string;
  contactEmail?: string;
  status: string;
  adminNotes?: string;
  createdAt: string;
}

export const BugManagementQueue: React.FC = () => {
  const [reports, setReports] = useState<BugReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'new' | 'in_progress' | 'resolved' | 'dismissed' | 'all'>('new');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchReports = async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bugs/list?status=${status}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch bug reports');
      setReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching bug reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(filter);
  }, [filter]);

  const handleUpdateStatus = async (reportId: string, newStatus: string) => {
    setProcessingId(reportId);
    try {
      const res = await fetch('/api/admin/bugs/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update bug status');

      if (filter !== 'all') {
        setReports((prev) => prev.filter((item) => item.id !== reportId));
      } else {
        setReports((prev) =>
          prev.map((item) => (item.id === reportId ? { ...item, status: newStatus } : item))
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update bug status');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 text-zinc-100">
      {/* Filter Tabs & Refresh */}
      <div className="flex items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800 p-3 rounded-2xl">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'new', label: 'New Reports' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'resolved', label: 'Resolved' },
            { id: 'dismissed', label: 'Dismissed' },
            { id: 'all', label: 'All Reports' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                filter === tab.id
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => fetchReports(filter)}
          disabled={loading}
          className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
          title="Refresh Reports"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reports List */}
      {loading ? (
        <div className="py-16 text-center text-zinc-500 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-red-500" />
          <span>Loading bug reports...</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl">
          <CheckCircle2 className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <h4 className="text-zinc-300 font-semibold">No {filter} bug reports</h4>
          <p className="text-xs text-zinc-500 mt-1">There are no reports matching the selected category.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 space-y-4 transition-all hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-base">#{item.ticketId}</span>
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-semibold text-[11px] uppercase">
                      {item.category}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md font-semibold text-[11px] uppercase ${
                        item.severity === 'high'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : item.severity === 'medium'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {item.severity} severity
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[11px] capitalize">
                      Status: {item.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-200">{item.title}</h4>
                </div>

                <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {item.description}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-zinc-400 font-mono">
                <div className="flex items-center gap-1.5 truncate">
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <a
                    href={item.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-red-400 truncate underline"
                  >
                    {item.pageUrl}
                  </a>
                </div>
                {item.contactEmail && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span>{item.contactEmail}</span>
                  </div>
                )}
              </div>

              {/* Status Action Buttons */}
              <div className="pt-2 border-t border-zinc-900 flex items-center justify-end gap-2 flex-wrap">
                {item.status !== 'in_progress' && (
                  <button
                    onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                    disabled={processingId === item.id}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    In Progress
                  </button>
                )}
                {item.status !== 'resolved' && (
                  <button
                    onClick={() => handleUpdateStatus(item.id, 'resolved')}
                    disabled={processingId === item.id}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark Resolved
                  </button>
                )}
                {item.status !== 'dismissed' && (
                  <button
                    onClick={() => handleUpdateStatus(item.id, 'dismissed')}
                    disabled={processingId === item.id}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
