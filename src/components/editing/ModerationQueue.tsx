import React, { useState, useEffect } from 'react';
import { Check, X, ShieldAlert, Loader2, RefreshCw, Layers } from 'lucide-react';

interface Suggestion {
  id: string;
  trackingId?: string | null;
  gameId: string;
  gameTitle: string | null;
  gameSlug: string | null;
  field: string;
  oldValue: string | null;
  newValue: string;
  reason: string | null;
  status: string;
  aiStatus?: string | null;
  aiConfidence?: number | null;
  aiReasoning?: string | null;
  userIp: string | null;
  createdAt: string;
}

export const ModerationQueue: React.FC = () => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'auto_approved' | 'approved' | 'rejected'>('pending');

  const fetchQueue = async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/edits/queue?status=${status}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch queue');
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue(filter);
  }, [filter]);

  const handleApprove = async (suggestionId: string) => {
    setProcessingId(suggestionId);
    try {
      const res = await fetch('/api/admin/edits/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, reviewerId: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve suggestion');

      // Remove from active pending view
      setSuggestions((prev) => prev.filter((item) => item.id !== suggestionId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve suggestion');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (suggestionId: string) => {
    setProcessingId(suggestionId);
    try {
      const res = await fetch('/api/admin/edits/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, reviewerId: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject suggestion');

      setSuggestions((prev) => prev.filter((item) => item.id !== suggestionId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject suggestion');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Tabs & Refresh */}
      <div className="flex items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800 p-3 rounded-2xl">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'pending', label: 'Pending Review' },
            { id: 'auto_approved', label: '⚡ Auto-Approved' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
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
          onClick={() => fetchQueue(filter)}
          disabled={loading}
          className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
          title="Refresh Queue"
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

      {/* Queue Content */}
      {loading ? (
        <div className="py-16 text-center text-zinc-500 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-red-500" />
          <span>Loading edit suggestions...</span>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl">
          <Layers className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <h4 className="text-zinc-300 font-semibold">No {filter} edits</h4>
          <p className="text-xs text-zinc-500 mt-1">The moderation queue for this category is currently empty.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {suggestions.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/80 hover:border-zinc-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-semibold text-zinc-200">
                    {item.gameTitle || item.gameId}
                  </span>
                  {item.gameSlug && (
                    <a
                      href={`/game/${item.gameSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      /game/{item.gameSlug} ↗
                    </a>
                  )}
                  <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                    field: {item.field}
                  </span>
                  {item.status === 'auto_approved' && (
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                      ⚡ Auto-Published
                    </span>
                  )}
                  {item.aiStatus && (
                    <span
                      title={item.aiReasoning || ''}
                      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold flex items-center gap-1 ${
                        item.aiStatus === 'passed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : item.aiStatus === 'flagged'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      🤖 {item.aiStatus === 'passed' ? 'AI Clean' : item.aiStatus === 'flagged' ? 'AI Flagged' : 'AI Rejected'}
                      {typeof item.aiConfidence === 'number' && ` (${Math.round(item.aiConfidence * 100)}%)`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 text-xs">
                    <span className="block font-medium text-zinc-500 mb-1">Old Value</span>
                    <span className="text-zinc-400 break-words line-clamp-3 italic">
                      {item.oldValue || '(Empty)'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs">
                    <span className="block font-medium text-emerald-400 mb-1">Suggested Value</span>
                    <span className="text-emerald-200 font-medium break-words line-clamp-3">
                      {item.newValue}
                    </span>
                  </div>
                </div>

                {item.reason && (
                  <p className="text-xs text-zinc-400 italic">
                    Reason: <span className="text-zinc-300 not-italic">"{item.reason}"</span>
                  </p>
                )}

                <div className="text-[10px] text-zinc-500 flex items-center gap-3 font-mono">
                  {item.trackingId && <span className="text-red-400 font-bold">Ref: #{item.trackingId}</span>}
                  <span>ID: {item.id}</span>
                  <span>Submitted: {new Date(item.createdAt).toLocaleString()}</span>
                  {item.userIp && <span>IP: {item.userIp}</span>}
                </div>
              </div>

              {/* Action Buttons */}
              {filter === 'pending' && (
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-zinc-800">
                  <button
                    onClick={() => handleReject(item.id)}
                    disabled={processingId === item.id}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={processingId === item.id}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {processingId === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Approve
                  </button>
                </div>
              )}

              {filter === 'auto_approved' && (
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-zinc-800">
                  <button
                    onClick={() => handleReject(item.id)}
                    disabled={processingId === item.id}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    title="Override & revert this auto-approved edit"
                  >
                    <X className="w-4 h-4" />
                    Override & Revert
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
