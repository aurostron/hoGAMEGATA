import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, CheckCircle2, AlertCircle, X, Loader2, Copy, Check, Link2, FileText, Building2, Star, Gamepad2, Terminal, RefreshCw } from 'lucide-react';
import { TurnstileWidget } from '../ui/TurnstileWidget';

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
    pegiRating?: string;
    rating?: number | null;
    metacritic?: number | null;
    playtime?: number | null;
    platformNames?: string;
    protonDbTier?: string;
    steamAppId?: string | number | null;
  };
  initialFieldKey?: string;
}

const AVAILABLE_PLATFORMS = [
  "PC (Microsoft Windows)",
  "Linux",
  "Mac",
  "PlayStation 5",
  "PlayStation 4",
  "Xbox Series X/S",
  "Xbox One",
  "Nintendo Switch",
];

const ESRB_OPTIONS = [
  "Everyone",
  "Everyone 10+",
  "Teen",
  "Mature 17+",
  "Adults Only 18+",
  "Rating Pending",
];

const PEGI_OPTIONS = [
  "PEGI 3",
  "PEGI 7",
  "PEGI 12",
  "PEGI 16",
  "PEGI 18",
];

const PROTON_TIERS = [
  "native",
  "platinum",
  "gold",
  "silver",
  "bronze",
  "borka",
];

export const EditPageModal: React.FC<EditPageModalProps> = ({
  isOpen,
  onClose,
  gameId,
  gameTitle,
  gameData,
  initialFieldKey = 'summary',
}) => {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'ratings' | 'platforms' | 'linux' | 'links' | 'developers'>('general');
  const [selectedField, setSelectedField] = useState<string>(initialFieldKey);

  const fieldsConfig: Record<string, { label: string; tab: 'general' | 'ratings' | 'platforms' | 'linux' | 'links' | 'developers'; isMultiline?: boolean; value: string }> = {
    summary: { label: 'Summary', tab: 'general', isMultiline: true, value: gameData.summary || '' },
    storyline: { label: 'Storyline', tab: 'general', isMultiline: true, value: gameData.storyline || '' },
    metacritic: { label: 'Metacritic Score', tab: 'ratings', isMultiline: false, value: gameData.metacritic !== null && gameData.metacritic !== undefined ? String(gameData.metacritic) : '' },
    rating: { label: 'Overall Rating (0-100)', tab: 'ratings', isMultiline: false, value: gameData.rating !== null && gameData.rating !== undefined ? String(gameData.rating) : '' },
    playtime: { label: 'Avg Playtime (Hours)', tab: 'ratings', isMultiline: false, value: gameData.playtime !== null && gameData.playtime !== undefined ? String(gameData.playtime) : '' },
    esrbRating: { label: 'ESRB Rating', tab: 'ratings', isMultiline: false, value: gameData.esrbRating || '' },
    pegiRating: { label: 'PEGI Rating', tab: 'ratings', isMultiline: false, value: gameData.pegiRating || '' },
    platformNames: { label: 'Supported Platforms', tab: 'platforms', isMultiline: false, value: gameData.platformNames || '' },
    protonDbTier: { label: 'Linux / ProtonDB Tier', tab: 'linux', isMultiline: false, value: gameData.protonDbTier || '' },
    websiteUrl: { label: 'Official Website URL', tab: 'links', isMultiline: false, value: gameData.websiteUrl || '' },
    redditUrl: { label: 'Reddit URL / Subreddit', tab: 'links', isMultiline: false, value: gameData.redditUrl || '' },
    trailerUrl: { label: 'Trailer Video URL', tab: 'links', isMultiline: false, value: gameData.trailerUrl || '' },
    developerNames: { label: 'Developer Name(s)', tab: 'developers', isMultiline: false, value: gameData.developerNames || '' },
  };

  const [newValue, setNewValue] = useState(() => fieldsConfig[initialFieldKey]?.value || '');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedTrackingId, setSubmittedTrackingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // ProtonDB Auto-Fetch State
  const [steamInput, setSteamInput] = useState(() => String(gameData.steamAppId || ''));
  const [protonFetching, setProtonFetching] = useState(false);
  const [protonFetchNotice, setProtonFetchNotice] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When initialFieldKey or isOpen changes, sync tab and field
  useEffect(() => {
    if (isOpen) {
      const field = fieldsConfig[initialFieldKey] ? initialFieldKey : 'summary';
      setSelectedField(field);
      setActiveTab(fieldsConfig[field]?.tab || 'general');
      setNewValue(fieldsConfig[field]?.value || '');
      setError(null);
      setProtonFetchNotice(null);
      setTurnstileToken(null);
    }
  }, [isOpen, initialFieldKey]);

  // Auto-focus input when modal opens or field changes
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, selectedField]);

  // Handle keyboard shortcut (Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleResetAndClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const currentConfig = fieldsConfig[selectedField] || fieldsConfig.summary;

  const handleFieldChange = (fieldKey: string) => {
    setSelectedField(fieldKey);
    setNewValue(fieldsConfig[fieldKey]?.value || '');
    setError(null);
    setProtonFetchNotice(null);
    setTurnstileToken(null);
  };

  const handleResetAndClose = () => {
    setError(null);
    setSubmittedTrackingId(null);
    setCopied(false);
    setProtonFetchNotice(null);
    setTurnstileToken(null);
    onClose();
  };

  // Platform Checkbox Helpers
  const currentSelectedPlatforms = newValue
    ? newValue.split(',').map((p) => p.trim()).filter(Boolean)
    : [];

  const togglePlatform = (platform: string) => {
    let updated: string[];
    if (currentSelectedPlatforms.includes(platform)) {
      updated = currentSelectedPlatforms.filter((p) => p !== platform);
    } else {
      updated = [...currentSelectedPlatforms, platform];
    }
    setNewValue(updated.join(', '));
  };

  // Auto Fetch ProtonDB Rating Helper
  const handleAutoFetchProtonDb = async () => {
    if (!steamInput.trim()) {
      setError('Please provide a Steam App ID or ProtonDB URL to auto-fetch.');
      return;
    }

    setProtonFetching(true);
    setError(null);
    setProtonFetchNotice(null);

    try {
      const res = await fetch(`/api/protondb/fetch?appId=${encodeURIComponent(steamInput.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ProtonDB report not found for this App ID.');
      }

      if (data.tier) {
        setNewValue(data.tier.toLowerCase());
        setProtonFetchNotice(`Auto-fetched from ProtonDB: Tier "${data.tier.toUpperCase()}" (${data.confidence || 'good'} confidence · ${data.totalReports || 0} reports)`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to auto-fetch ProtonDB data');
    } finally {
      setProtonFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) {
      setError('Please complete the CAPTCHA verification.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/edits/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          gameTitle,
          field: selectedField,
          fieldLabel: currentConfig.label,
          oldValue: currentConfig.value,
          newValue,
          reason,
          turnstileToken,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await response.json().catch(() => ({}));
      } else {
        const textBody = await response.text().catch(() => '');
        if (textBody.includes('<html') || textBody.includes('<!DOCTYPE')) {
          let cleanErr = '';
          if (textBody.includes('TypeError: fetch failed')) {
            cleanErr = 'Server connection error (fetch failed). Please try again.';
          } else {
            const titleMatch = textBody.match(/<title[^>]*>(.*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1].trim() : '';
            cleanErr = title && title !== 'Error' ? title : `Server error (${response.status}). Please try again.`;
          }
          data = { error: cleanErr };
        } else {
          data = { error: textBody ? textBody.replace(/<[^>]+>/g, '').substring(0, 150) : `Server error (${response.status})` };
        }
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit edit proposal. Please try again.');
      }

      setSubmittedTrackingId(data.trackingId || String(Date.now()).slice(-6));
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = () => {
    if (submittedTrackingId) {
      navigator.clipboard.writeText(submittedTrackingId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl sm:max-w-4xl bg-[#0e0e11] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 border border-white/20 text-white">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Suggest Edit: {gameTitle}</h3>
              <p className="text-xs font-mono text-neutral-400">Submit metadata improvements or fixes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="p-2 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
          {submittedTrackingId ? (
            <div className="py-8 text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white">Edit Proposal Submitted!</h4>
                <p className="text-sm text-neutral-400 mt-1">
                  Your edit for <span className="text-white font-semibold">{currentConfig.label}</span> has been queued for moderation.
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                <div className="text-left">
                  <span className="block text-[10px] font-mono uppercase font-bold text-neutral-400">Support Tracking Code</span>
                  <span className="text-xl font-mono font-extrabold text-white">#{submittedTrackingId}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="px-4 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-3 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-full py-3 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Category Tabs */}
              <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
                {[
                  { id: 'general', label: 'General & Text', icon: FileText },
                  { id: 'ratings', label: 'Ratings & Specs', icon: Star },
                  { id: 'platforms', label: 'Platforms', icon: Gamepad2 },
                  { id: 'linux', label: 'Linux / ProtonDB', icon: Terminal },
                  { id: 'links', label: 'Links & Media', icon: Link2 },
                  { id: 'developers', label: 'Developers', icon: Building2 },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        const firstField = Object.keys(fieldsConfig).find(k => fieldsConfig[k].tab === tab.id);
                        if (firstField) handleFieldChange(firstField);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-white text-black font-bold shadow-lg'
                          : 'text-neutral-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Field Pills inside active tab */}
              <div className="flex flex-wrap gap-2">
                {Object.keys(fieldsConfig)
                  .filter((key) => fieldsConfig[key].tab === activeTab)
                  .map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleFieldChange(key)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
                        selectedField === key
                          ? 'bg-white/15 border-white text-white font-bold'
                          : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {fieldsConfig[key].label}
                    </button>
                  ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 pt-1">
                {error && (
                  <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {protonFetchNotice && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{protonFetchNotice}</span>
                  </div>
                )}

                {/* Current Value Display */}
                <div>
                  <label className="block text-xs font-mono font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">
                    Current {currentConfig.label}
                  </label>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-mono text-neutral-300 italic break-words max-h-28 overflow-y-auto">
                    {currentConfig.value || <span className="not-italic text-neutral-500">(Empty / Unset)</span>}
                  </div>
                </div>

                {/* Custom Interactive Controls depending on selectedField */}
                {selectedField === 'platformNames' ? (
                  /* Interactive Platform Checkboxes */
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-white">
                      Select Available Supported Platforms
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 rounded-2xl bg-[#09090c] border border-white/15">
                      {AVAILABLE_PLATFORMS.map((platform) => {
                        const isChecked = currentSelectedPlatforms.includes(platform);
                        return (
                          <button
                            key={platform}
                            type="button"
                            onClick={() => togglePlatform(platform)}
                            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-mono font-medium transition-all text-left border cursor-pointer ${
                              isChecked
                                ? 'bg-white/15 border-white text-white font-bold'
                                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold border ${isChecked ? 'bg-white border-white text-black' : 'border-neutral-600'}`}>
                              {isChecked ? '✓' : ''}
                            </span>
                            <span className="truncate">{platform}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs font-mono text-neutral-400">
                      Formatted Platform String: <span className="text-white font-bold">{newValue || '(None selected)'}</span>
                    </p>
                  </div>
                ) : selectedField === 'protonDbTier' ? (
                  /* ProtonDB Auto-Fetch & Tier Selection */
                  <div className="space-y-4">
                    <label className="block text-xs font-bold text-white">
                      Linux / ProtonDB Compatibility Tier
                    </label>
                    
                    {/* Auto-Fetch Bar */}
                    <div className="p-4 rounded-2xl bg-[#09090c] border border-white/15 space-y-3">
                      <span className="block text-xs font-mono font-bold text-white uppercase tracking-wider">
                        ⚡ Automated ProtonDB Rating Fetch
                      </span>
                      <div className="flex items-center gap-2.5">
                        <input
                          type="text"
                          value={steamInput}
                          onChange={(e) => setSteamInput(e.target.value)}
                          placeholder="Enter Steam App ID or ProtonDB URL..."
                          className="flex-1 rounded-xl bg-white/5 border border-white/10 p-3 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-white"
                        />
                        <button
                          type="button"
                          onClick={handleAutoFetchProtonDb}
                          disabled={protonFetching}
                          className="px-4 py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          {protonFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          <span>Auto Fetch</span>
                        </button>
                      </div>
                    </div>

                    {/* Tier Pills */}
                    <div>
                      <span className="block text-xs font-mono text-neutral-400 mb-2">Select Proton Tier manually:</span>
                      <div className="flex flex-wrap gap-2">
                        {PROTON_TIERS.map((tier) => (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => setNewValue(tier)}
                            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase transition-all border cursor-pointer ${
                              newValue.toLowerCase() === tier
                                ? 'bg-white text-black border-white'
                                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {tier}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : selectedField === 'esrbRating' ? (
                  /* ESRB Rating Pills */
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-white">
                      ESRB Age Rating
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ESRB_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setNewValue(opt)}
                          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer ${
                            newValue === opt
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : selectedField === 'pegiRating' ? (
                  /* PEGI Rating Pills */
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-white">
                      PEGI Rating
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PEGI_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setNewValue(opt)}
                          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer ${
                            newValue === opt
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Default Input / Textarea */
                  <div>
                    <label className="block text-xs font-bold text-white mb-1.5">
                      Suggested New {currentConfig.label}
                    </label>
                    {currentConfig.isMultiline ? (
                      <textarea
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        rows={5}
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder={`Enter correct ${currentConfig.label.toLowerCase()}...`}
                        className="w-full rounded-2xl bg-[#09090c] border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all resize-none block select-text cursor-text"
                        required
                      />
                    ) : (
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type={['metacritic', 'rating', 'playtime'].includes(selectedField) ? 'number' : 'text'}
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder={`Enter correct ${currentConfig.label.toLowerCase()}...`}
                        className="w-full rounded-2xl bg-[#09090c] border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all block select-text cursor-text"
                        required
                      />
                    )}
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    Reason for Change <span className="text-neutral-500 font-normal font-mono text-[11px]">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Official update, verified source link..."
                    className="w-full rounded-2xl bg-white/5 border border-white/10 p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 transition-all"
                  />
                </div>

                {/* Turnstile CAPTCHA */}
                <TurnstileWidget
                  onVerify={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken(null)}
                  onError={() => setTurnstileToken(null)}
                />

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl text-xs font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold text-xs transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg cursor-pointer"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin text-black" />}
                    Submit Suggestion
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
