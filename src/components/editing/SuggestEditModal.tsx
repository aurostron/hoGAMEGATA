import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, CheckCircle2, AlertCircle, X, Loader2, Copy, Check } from 'lucide-react';

interface SuggestEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameTitle: string;
  field: string;
  fieldLabel: string;
  currentValue: string;
  isMultiline?: boolean;
}

export const SuggestEditModal: React.FC<SuggestEditModalProps> = ({
  isOpen,
  onClose,
  gameId,
  gameTitle,
  field,
  fieldLabel,
  currentValue,
  isMultiline = false,
}) => {
  const [mounted, setMounted] = useState(false);
  const [newValue, setNewValue] = useState(currentValue || '');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedTrackingId, setSubmittedTrackingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleResetAndClose = () => {
    setError(null);
    setSubmittedTrackingId(null);
    setCopied(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) {
      setError('Please provide a new value for this field.');
      return;
    }
    if (newValue.trim() === (currentValue || '').trim()) {
      setError('New value must be different from the current value.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/edits/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          field,
          oldValue: currentValue,
          newValue: newValue.trim(),
          reason: reason.trim(),
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      } else {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit edit suggestion');
      }

      setSubmittedTrackingId(data.trackingId || '482910');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = () => {
    if (!submittedTrackingId) return;
    navigator.clipboard.writeText(`#${submittedTrackingId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl text-zinc-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 shrink-0 bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-lg leading-snug">Suggest Edit</h3>
              <p className="text-xs text-zinc-400">{gameTitle} &bull; <span className="text-red-400">{fieldLabel}</span></p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {submittedTrackingId ? (
            <div className="py-6 space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-white">Edit Proposal Submitted!</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Your suggestion for <span className="text-white font-medium">{fieldLabel}</span> will be reviewed by moderators.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3">
                <div className="text-left">
                  <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500">Tracking Code</span>
                  <span className="text-lg font-mono font-bold text-white">#{submittedTrackingId}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Current Value */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Current {fieldLabel}
                </label>
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 break-words max-h-24 overflow-y-auto">
                  {currentValue || <span className="text-zinc-600 italic">(Empty)</span>}
                </div>
              </div>

              {/* Suggested Value */}
              <div>
                <label className="block text-xs font-medium text-zinc-200 mb-1">
                  Suggested New {fieldLabel}
                </label>
                {isMultiline ? (
                  <textarea
                    rows={4}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder={`Enter correct ${fieldLabel.toLowerCase()}...`}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors resize-none"
                    required
                  />
                ) : (
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder={`Enter correct ${fieldLabel.toLowerCase()}...`}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors"
                    required
                  />
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Reason for Change <span className="text-zinc-600 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Typo fix, official update, source link..."
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-600/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Suggestion
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
