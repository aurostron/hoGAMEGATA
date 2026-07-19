import React, { useState } from 'react';
import { Pencil, CheckCircle2, AlertCircle, X, Loader2, Copy, Check, Link2, FileText, Building2 } from 'lucide-react';

interface EditPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameTitle: string;
  gameData: {
    developerNames?: string;
    summary?: string;
    storyline?: string;
    trailerUrl?: string;
    websiteUrl?: string;
    redditUrl?: string;
    esrbRating?: string;
    pressQuotes?: string;
  };
}

export const EditPageModal: React.FC<EditPageModalProps> = ({
  isOpen,
  onClose,
  gameId,
  gameTitle,
  gameData,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'links' | 'developers'>('general');
  const [selectedField, setSelectedField] = useState<string>('summary');

  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedTrackingId, setSubmittedTrackingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const fieldsConfig: Record<string, { label: string; tab: string; isMultiline?: boolean; value: string }> = {
    summary: { label: 'Summary', tab: 'general', isMultiline: true, value: gameData.summary || '' },
    storyline: { label: 'Storyline', tab: 'general', isMultiline: true, value: gameData.storyline || '' },
    esrbRating: { label: 'ESRB Rating', tab: 'general', isMultiline: false, value: gameData.esrbRating || '' },
    websiteUrl: { label: 'Official Website URL', tab: 'links', isMultiline: false, value: gameData.websiteUrl || '' },
    redditUrl: { label: 'Reddit URL / Subreddit', tab: 'links', isMultiline: false, value: gameData.redditUrl || '' },
    trailerUrl: { label: 'Trailer Video URL', tab: 'links', isMultiline: false, value: gameData.trailerUrl || '' },
    developerNames: { label: 'Developer Name(s)', tab: 'developers', isMultiline: false, value: gameData.developerNames || '' },
  };

  const handleFieldChange = (fieldKey: string) => {
    setSelectedField(fieldKey);
    setNewValue(fieldsConfig[fieldKey]?.value || '');
    setError(null);
  };

  const handleResetAndClose = () => {
    setError(null);
    setSubmittedTrackingId(null);
    setCopied(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentVal = fieldsConfig[selectedField]?.value || '';
    if (!newValue.trim()) {
      setError('Please provide a new value for this field.');
      return;
    }
    if (newValue.trim() === currentVal.trim()) {
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
          field: selectedField,
          oldValue: currentVal,
          newValue: newValue.trim(),
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit edit suggestion');

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

  const currentConfig = fieldsConfig[selectedField] || fieldsConfig.summary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#0e0e11] p-6 shadow-2xl text-white space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-white">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-snug">Edit Game Page</h3>
              <p className="text-xs text-neutral-400">{gameTitle}</p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submittedTrackingId ? (
          <div className="py-6 space-y-5 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-white">Edit Proposal Submitted!</h4>
              <p className="text-xs text-neutral-400 mt-1">
                Your edit for <span className="text-white font-semibold">{currentConfig.label}</span> has been queued for moderation.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div className="text-left">
                <span className="block text-[10px] font-mono uppercase font-bold text-neutral-400">Support Tracking Code</span>
                <span className="text-lg font-mono font-extrabold text-white">#{submittedTrackingId}</span>
              </div>
              <button
                onClick={handleCopyId}
                className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95"
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
                onClick={handleResetAndClose}
                className="w-full py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Category Tabs */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              {[
                { id: 'general', label: 'General & Text', icon: FileText },
                { id: 'links', label: 'Links & Media', icon: Link2 },
                { id: 'developers', label: 'Developers', icon: Building2 },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      const firstField = Object.keys(fieldsConfig).find(k => fieldsConfig[k].tab === tab.id);
                      if (firstField) handleFieldChange(firstField);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-white text-black font-bold shadow-md'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Field Pills inside active tab */}
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(fieldsConfig)
                .filter((key) => fieldsConfig[key].tab === activeTab)
                .map((key) => (
                  <button
                    key={key}
                    onClick={() => handleFieldChange(key)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                      selectedField === key
                        ? 'bg-white/15 border-white/40 text-white font-bold'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {fieldsConfig[key].label}
                  </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Current Value */}
              <div>
                <label className="block text-xs font-mono font-bold text-neutral-400 mb-1 uppercase tracking-wider">
                  Current {currentConfig.label}
                </label>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-neutral-300 italic break-words max-h-24 overflow-y-auto">
                  {currentConfig.value || <span className="not-italic text-neutral-500">(Empty / Unset)</span>}
                </div>
              </div>

              {/* Suggested Value */}
              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Suggested New {currentConfig.label}
                </label>
                {currentConfig.isMultiline ? (
                  <textarea
                    rows={4}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder={`Enter correct ${currentConfig.label.toLowerCase()}...`}
                    className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/30 transition-all resize-none"
                    required
                  />
                ) : (
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder={`Enter correct ${currentConfig.label.toLowerCase()}...`}
                    className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/30 transition-all"
                    required
                  />
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Reason for Change <span className="text-neutral-500 font-normal font-mono text-[11px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Official company rename, verified link..."
                  className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/30 transition-all"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg cursor-pointer"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Suggestion
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
