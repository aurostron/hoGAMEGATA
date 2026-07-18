import React, { useState, useEffect } from 'react';
import { History, X, RotateCcw, Loader2, Calendar, User, Clock, AlertCircle } from 'lucide-react';

interface Revision {
  id: string;
  gameId: string;
  suggestionId: string | null;
  editedBy: string;
  changes: {
    field?: string;
    oldValue?: string | null;
    newValue?: string;
    reason?: string | null;
  };
  createdAt: string;
}

interface RevisionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameTitle: string;
  isAdmin?: boolean;
}

export const RevisionHistoryModal: React.FC<RevisionHistoryModalProps> = ({
  isOpen,
  onClose,
  gameId,
  gameTitle,
  isAdmin = false,
}) => {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/history?gameId=${encodeURIComponent(gameId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load history');
      setRevisions(data.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch revision history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, gameId]);

  const handleRollback = async (revisionId: string) => {
    if (!confirm('Are you sure you want to rollback this change? This will update the live game metadata.')) {
      return;
    }

    setRollingBackId(revisionId);
    try {
      const res = await fetch('/api/admin/edits/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionId, reviewerId: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rollback failed');

      alert(data.message || 'Rollback successful!');
      fetchHistory(); // Reload history
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setRollingBackId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl text-zinc-100 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-lg leading-snug">Revision History</h3>
              <p className="text-xs text-zinc-400">{gameTitle} &bull; <span className="text-red-400">{revisions.length} total edits</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-zinc-500 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-red-500" />
              <span>Loading edit timeline...</span>
            </div>
          ) : revisions.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 space-y-1">
              <Clock className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-zinc-400">No revisions found</p>
              <p className="text-xs text-zinc-600">This title has no registered community edits yet.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-zinc-800 ml-4 space-y-6">
              {revisions.map((rev) => (
                <div key={rev.id} className="relative pl-6">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-zinc-900 border-2 border-red-500" />

                  <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 hover:border-zinc-700 transition-all space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <User className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="font-semibold text-zinc-200">@{rev.editedBy}</span>
                        <span>&bull;</span>
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{new Date(rev.createdAt).toLocaleString()}</span>
                      </div>

                      {rev.changes.field && (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                          {rev.changes.field}
                        </span>
                      )}
                    </div>

                    {/* Diff View */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-zinc-400 italic break-words">
                        <span className="block font-medium text-zinc-500 text-[10px] uppercase mb-0.5">Previous</span>
                        {rev.changes.oldValue || <span className="not-italic text-zinc-600">(Empty)</span>}
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 font-medium break-words">
                        <span className="block font-medium text-emerald-400/80 text-[10px] uppercase mb-0.5">Updated</span>
                        {rev.changes.newValue || '(Empty)'}
                      </div>
                    </div>

                    {rev.changes.reason && (
                      <p className="text-xs text-zinc-400 italic pt-1">
                        Reason: <span className="text-zinc-300 not-italic">"{rev.changes.reason}"</span>
                      </p>
                    )}

                    {/* Rollback Trigger */}
                    {isAdmin && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => handleRollback(rev.id)}
                          disabled={rollingBackId === rev.id}
                          className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {rollingBackId === rev.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          Rollback to this
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
