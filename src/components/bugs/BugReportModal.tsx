import React, { useState, useEffect } from 'react';
import { X, Send, Copy, Check, ShieldAlert, CheckCircle2, Loader2, Link2, Bug, FileText, Lightbulb } from 'lucide-react';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({ isOpen, onClose }) => {
  const [category, setCategory] = useState<'bug' | 'broken_link' | 'incorrect_metadata' | 'feature_request'>('bug');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [pageUrl, setPageUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPageUrl(window.location.href);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Please provide a short summary and description.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/bugs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          severity,
          title: title.trim(),
          description: description.trim(),
          pageUrl,
          contactEmail: contactEmail.trim() || undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit issue report');

      setSubmittedTicketId(data.ticketId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTicket = () => {
    if (submittedTicketId) {
      navigator.clipboard.writeText(submittedTicketId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0e0e11] border border-white/10 p-6 shadow-2xl space-y-5 text-white">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-white leading-tight">
              Report an Issue
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Found a broken link, wrong info, or a glitch? Let us know so we can fix it.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submittedTicketId ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-extrabold text-white">Thank you for reporting!</h4>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Your feedback helps keep hoGAMEGATA accurate and smooth.
            </p>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <span className="text-[11px] font-mono text-neutral-400 uppercase font-bold block">
                Reference ID
              </span>
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-mono font-bold text-white">#{submittedTicketId}</span>
                <button
                  onClick={handleCopyTicket}
                  className="p-1 rounded-lg bg-white/10 text-neutral-300 hover:text-white transition-colors"
                  title="Copy Reference ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Category Selector */}
            <div>
              <label className="block text-xs font-mono font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">
                What type of issue is this?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'bug', label: 'Bug / Glitch', icon: Bug },
                  { id: 'broken_link', label: 'Broken Link', icon: Link2 },
                  { id: 'incorrect_metadata', label: 'Wrong Info', icon: FileText },
                  { id: 'feature_request', label: 'Feature Idea', icon: Lightbulb },
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id as any)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-medium text-left border transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-white/10 border-white/30 text-white font-bold'
                          : 'bg-white/5 border-white/10 text-neutral-400 hover:border-white/20 hover:text-neutral-200'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-neutral-500'}`} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-xs font-mono font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">
                Impact Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'low', label: 'Minor' },
                  { id: 'medium', label: 'Normal' },
                  { id: 'high', label: 'Page Broken' },
                ].map((sev) => (
                  <button
                    key={sev.id}
                    type="button"
                    onClick={() => setSeverity(sev.id as any)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                      severity === sev.id
                        ? 'bg-white/15 border-white/30 text-white font-bold'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {sev.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Short Summary
              </label>
              <input
                type="text"
                placeholder="e.g. Broken price link or missing system specs"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 text-xs font-mono focus:outline-none focus:border-white/30 transition-colors"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                placeholder="Tell us what went wrong..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 text-xs font-mono focus:outline-none focus:border-white/30 resize-none transition-colors"
                required
              />
            </div>

            {/* Contact Email (Optional) */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Your Email <span className="text-neutral-500 font-normal font-mono text-[11px]">(Optional)</span>
              </label>
              <input
                type="email"
                placeholder="name@example.com (if you'd like a follow-up)"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 text-xs font-mono focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>

            {/* Auto-attached Page Context */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-neutral-400 font-mono flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span className="truncate">Auto-attached page: <span className="text-white">{pageUrl}</span></span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-white/10 text-neutral-300 hover:text-white hover:bg-white/5 text-xs font-mono transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-lg"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Submit Report</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
