import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Pencil,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Copy,
  Check,
  Link2,
  FileText,
  Building2,
  Star,
  Gamepad2,
  Terminal,
  RefreshCw,
  Calendar,
  Tag,
  Users,
  ShieldAlert,
  Glasses,
  Clock,
  Info,
} from 'lucide-react';
import { TurnstileWidget } from '../ui/TurnstileWidget';

export interface PurchaseLinkItem {
  id?: string;
  storeName: string;
  url: string;
}

export interface EditPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameTitle: string;
  gameData: {
    developerNames?: string;
    publisherNames?: string;
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
    purchaseLinks?: PurchaseLinkItem[];
    releaseDate?: string;
    genreNames?: string;
    multiplayer?: string;
    controllerSupport?: string;
    vrSupport?: string;
    playerWarnings?: string;
  };
  initialFieldKey?: string;
}

type TabType = 'general' | 'developers' | 'gameplay' | 'ratings' | 'platforms' | 'links';

const STORE_OPTIONS = [
  'Steam',
  'itch.io',
  'GOG',
  'Epic Games',
  'PlayStation',
  'Xbox',
  'Nintendo eShop',
  'Other Store',
];

const LINK_ISSUE_TYPES = [
  'Wrong Game / Mismatched',
  'Broken / Dead Link (404)',
  'Add Missing Store Link',
  'Wrong Edition / Demo',
];

const AVAILABLE_PLATFORMS = [
  'PC (Microsoft Windows)',
  'Linux',
  'Mac',
  'PlayStation 5',
  'PlayStation 4',
  'Xbox Series X/S',
  'Xbox One',
  'Nintendo Switch',
];

const ESRB_OPTIONS = [
  'Everyone',
  'Everyone 10+',
  'Teen',
  'Mature 17+',
  'Adults Only 18+',
  'Rating Pending',
];

const PEGI_OPTIONS = [
  'PEGI 3',
  'PEGI 7',
  'PEGI 12',
  'PEGI 16',
  'PEGI 18',
];

const PROTON_TIERS = [
  'native',
  'platinum',
  'gold',
  'silver',
  'bronze',
  'borka',
];

const HORROR_GENRE_PRESETS = [
  'Psychological Horror',
  'Survival Horror',
  'Found Footage',
  'Analog Horror',
  'Body Horror',
  'Cosmic Horror',
  'Retro / PS1 Style',
  'Haunted House',
  'Paranormal',
  'Action Horror',
  'Atmospheric',
  'Narrative / Story Rich',
  'Sci-Fi Horror',
  'Folk Horror',
];

const MULTIPLAYER_PRESETS = [
  'Single-Player Only',
  'Online Co-Op',
  'Local / Split-Screen',
  'Multiplayer PvP',
  'Cross-Platform Multiplayer',
];

const CONTROLLER_PRESETS = [
  'Full Controller Support',
  'Partial Controller Support',
  'Keyboard & Mouse Only',
];

const VR_PRESETS = [
  'Standard Screen (No VR)',
  'VR Supported',
  'VR Only',
];

const SAFETY_WARNING_PRESETS = [
  'Flashing Lights / Strobe',
  'Spiders (Arachnophobia)',
  'Extreme Blood & Gore',
  'Self-Harm Themes',
  'Sudden Loud Scares',
  'Claustrophobia (Tight Spaces)',
  'Disturbing Audio / Screaming',
  'Needles / Medical Horror',
];

const COMMON_PUBLISHER_SUGGESTIONS = [
  'Puppet Combo',
  'DreadXP',
  'Konami',
  'Capcom',
  'Feardemic',
  'Raw Fury',
  'Devolver Digital',
  'Bloober Team',
  'Red Barrels',
  'Team17',
  'Self-Published',
];

const TABS: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'general', label: 'General', icon: FileText },
  { id: 'developers', label: 'Devs & Publishers', icon: Building2 },
  { id: 'gameplay', label: 'Gameplay & Modes', icon: Gamepad2 },
  { id: 'ratings', label: 'Ratings & Warnings', icon: ShieldAlert },
  { id: 'platforms', label: 'Platforms & Linux', icon: Terminal },
  { id: 'links', label: 'Links & Stores', icon: Link2 },
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

  const fieldsConfig: Record<
    string,
    {
      label: string;
      tab: TabType;
      isMultiline?: boolean;
      value: string;
      helperText?: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  > = {
    // General
    summary: {
      label: 'Summary',
      tab: 'general',
      isMultiline: true,
      value: gameData.summary || '',
      helperText: 'A short overview of what happens in the game.',
      icon: FileText,
    },
    storyline: {
      label: 'Storyline',
      tab: 'general',
      isMultiline: true,
      value: gameData.storyline || '',
      helperText: 'Detailed plot, characters, and background lore.',
      icon: FileText,
    },
    releaseDate: {
      label: 'Release Date',
      tab: 'general',
      isMultiline: false,
      value: gameData.releaseDate || '',
      helperText: 'Public release date (YYYY-MM-DD) or TBD if still in development.',
      icon: Calendar,
    },
    genreNames: {
      label: 'Horror Styles & Tags',
      tab: 'general',
      isMultiline: false,
      value: gameData.genreNames || '',
      helperText: 'Tags and styles that best describe what makes this game scary.',
      icon: Tag,
    },

    // Devs & Publishers
    developerNames: {
      label: 'Developer Name(s)',
      tab: 'developers',
      isMultiline: false,
      value: gameData.developerNames || '',
      helperText: 'Studio or creators who developed the game.',
      icon: Building2,
    },
    publisherNames: {
      label: 'Publisher Name(s)',
      tab: 'developers',
      isMultiline: false,
      value: gameData.publisherNames || '',
      helperText: 'Publishing company or label (or Self-Published).',
      icon: Building2,
    },

    // Gameplay & Features
    multiplayer: {
      label: 'Game Modes (Solo / Co-Op)',
      tab: 'gameplay',
      isMultiline: false,
      value: gameData.multiplayer || '',
      helperText: 'Whether the game is single-player only or supports co-op/multiplayer.',
      icon: Users,
    },
    controllerSupport: {
      label: 'Controller Support',
      tab: 'gameplay',
      isMultiline: false,
      value: gameData.controllerSupport || '',
      helperText: 'Gamepad and controller compatibility level.',
      icon: Gamepad2,
    },
    vrSupport: {
      label: 'VR Support',
      tab: 'gameplay',
      isMultiline: false,
      value: gameData.vrSupport || '',
      helperText: 'Whether the game requires or supports Virtual Reality headsets.',
      icon: Glasses,
    },

    // Ratings & Warnings
    playerWarnings: {
      label: 'Safety & Content Warnings',
      tab: 'ratings',
      isMultiline: false,
      value: gameData.playerWarnings || '',
      helperText: 'Content triggers and phobias players should know about in advance.',
      icon: ShieldAlert,
    },
    rating: {
      label: 'Overall Rating (0-100)',
      tab: 'ratings',
      isMultiline: false,
      value: gameData.rating !== null && gameData.rating !== undefined ? String(gameData.rating) : '',
      helperText: 'Aggregate community score on a 100-point scale.',
      icon: Star,
    },
    metacritic: {
      label: 'Metacritic Score',
      tab: 'ratings',
      isMultiline: false,
      value: gameData.metacritic !== null && gameData.metacritic !== undefined ? String(gameData.metacritic) : '',
      helperText: 'Official Metacritic score (0-100).',
      icon: Star,
    },
    playtime: {
      label: 'Average Playtime (Hours)',
      tab: 'ratings',
      isMultiline: false,
      value: gameData.playtime !== null && gameData.playtime !== undefined ? String(gameData.playtime) : '',
      helperText: 'Average hours to complete the game.',
      icon: Clock,
    },
    esrbRating: {
      label: 'ESRB Rating',
      tab: 'ratings',
      isMultiline: false,
      value: gameData.esrbRating || '',
      helperText: 'North American age classification.',
      icon: ShieldAlert,
    },
    pegiRating: {
      label: 'PEGI Rating',
      tab: 'ratings',
      isMultiline: false,
      value: gameData.pegiRating || '',
      helperText: 'European age classification.',
      icon: ShieldAlert,
    },

    // Platforms & Linux
    platformNames: {
      label: 'Supported Platforms',
      tab: 'platforms',
      isMultiline: false,
      value: gameData.platformNames || '',
      helperText: 'Operating systems and consoles the game runs on.',
      icon: Gamepad2,
    },
    protonDbTier: {
      label: 'Linux / Steam Deck (ProtonDB)',
      tab: 'platforms',
      isMultiline: false,
      value: gameData.protonDbTier || '',
      helperText: 'Steam Deck and Linux compatibility tier.',
      icon: Terminal,
    },

    // Links & Stores
    purchaseLink: {
      label: 'Wrong Purchase Link',
      tab: 'links',
      isMultiline: false,
      value: gameData.purchaseLinks && gameData.purchaseLinks.length > 0
        ? gameData.purchaseLinks.map((l) => `${l.storeName}: ${l.url}`).join(' | ')
        : '',
      helperText: 'Report a broken, mismatched, or missing store deal.',
      icon: Link2,
    },
    trailerUrl: {
      label: 'Trailer Video URL',
      tab: 'links',
      isMultiline: false,
      value: gameData.trailerUrl || '',
      helperText: 'Official YouTube or video trailer link.',
      icon: Link2,
    },
    websiteUrl: {
      label: 'Official Website URL',
      tab: 'links',
      isMultiline: false,
      value: gameData.websiteUrl || '',
      helperText: 'Official developer or game homepage.',
      icon: Link2,
    },
    redditUrl: {
      label: 'Reddit URL / Community',
      tab: 'links',
      isMultiline: false,
      value: gameData.redditUrl || '',
      helperText: 'Official subreddit or developer community discussion.',
      icon: Link2,
    },
  };

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    return fieldsConfig[initialFieldKey]?.tab || 'general';
  });
  const [selectedField, setSelectedField] = useState<string>(initialFieldKey);

  // Purchase Link Edit State
  const [selectedStore, setSelectedStore] = useState<string>(() => gameData.purchaseLinks?.[0]?.storeName || 'Steam');
  const [linkIssueType, setLinkIssueType] = useState<string>('Wrong Game / Mismatched');
  const [customStoreUrl, setCustomStoreUrl] = useState<string>('');

  const formatPurchaseLinkProposal = (store: string, issue: string, url: string) => {
    const trimmed = url.trim();
    return trimmed
      ? `[Store: ${store}] [Issue: ${issue}] Correct URL: ${trimmed}`
      : `[Store: ${store}] [Issue: ${issue}] (Reported dead/broken link)`;
  };

  const [newValue, setNewValue] = useState(() => {
    if (initialFieldKey === 'purchaseLink') {
      const defaultStore = gameData.purchaseLinks?.[0]?.storeName || 'Steam';
      return formatPurchaseLinkProposal(defaultStore, 'Wrong Game / Mismatched', '');
    }
    return fieldsConfig[initialFieldKey]?.value || '';
  });

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

  // Sync state when modal opens or initialFieldKey changes
  useEffect(() => {
    if (isOpen) {
      const field = fieldsConfig[initialFieldKey] ? initialFieldKey : 'summary';
      setSelectedField(field);
      setActiveTab(fieldsConfig[field]?.tab || 'general');
      if (field === 'purchaseLink') {
        const defaultStore = gameData.purchaseLinks?.[0]?.storeName || 'Steam';
        setSelectedStore(defaultStore);
        setNewValue(formatPurchaseLinkProposal(defaultStore, linkIssueType, customStoreUrl));
      } else {
        setNewValue(fieldsConfig[field]?.value || '');
      }
      setError(null);
      setProtonFetchNotice(null);
      setTurnstileToken(null);
    }
  }, [isOpen, initialFieldKey]);

  // Auto-focus input when field changes
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, selectedField]);

  // Handle Escape key
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
    if (fieldKey === 'purchaseLink') {
      const store = selectedStore || gameData.purchaseLinks?.[0]?.storeName || 'Steam';
      setNewValue(formatPurchaseLinkProposal(store, linkIssueType, customStoreUrl));
    } else {
      setNewValue(fieldsConfig[fieldKey]?.value || '');
    }
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

  // Helper to toggle items in a comma-separated string
  const toggleCommaItem = (item: string) => {
    const list = newValue
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const index = list.findIndex((s) => s.toLowerCase() === item.toLowerCase());
    if (index >= 0) {
      list.splice(index, 1);
    } else {
      list.push(item);
    }
    setNewValue(list.join(', '));
  };

  const isCommaItemSelected = (item: string) => {
    return newValue
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .includes(item.toLowerCase());
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
              <p className="text-xs font-mono text-neutral-400">Community metadata improvements & fixes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            aria-label="Close edit modal"
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
                <h4 className="text-xl font-bold text-white">Edit Proposal Submitted</h4>
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
                      <span className="text-emerald-400">Copied</span>
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
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        const firstField = Object.keys(fieldsConfig).find((k) => fieldsConfig[k].tab === tab.id);
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
                  .map((key) => {
                    const FieldIcon = fieldsConfig[key].icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleFieldChange(key)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all border cursor-pointer flex items-center gap-2 ${
                          selectedField === key
                            ? 'bg-white/15 border-white text-white font-bold'
                            : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:border-white/20'
                        }`}
                      >
                        <FieldIcon className="w-3.5 h-3.5 opacity-80" />
                        <span>{fieldsConfig[key].label}</span>
                      </button>
                    );
                  })}
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider">
                      Current {currentConfig.label}
                    </label>
                    {currentConfig.helperText && (
                      <span className="text-[11px] text-neutral-500 font-mono flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        <span>{currentConfig.helperText}</span>
                      </span>
                    )}
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-mono text-neutral-300 italic break-words max-h-24 overflow-y-auto">
                    {currentConfig.value || <span className="not-italic text-neutral-500">(Empty / Unset)</span>}
                  </div>
                </div>

                {/* Custom Interactive Controls depending on selectedField */}
                {selectedField === 'releaseDate' ? (
                  /* Release Date Controls */
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-white">
                      Suggested Release Date
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setNewValue('TBD')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all border cursor-pointer ${
                          newValue.trim().toUpperCase() === 'TBD'
                            ? 'bg-white text-black font-bold border-white'
                            : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                        }`}
                      >
                        TBD (In Development)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          setNewValue(today);
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-mono border border-white/10 bg-white/5 text-neutral-400 hover:text-white transition-all cursor-pointer"
                      >
                        Set to Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewValue('')}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-mono border border-white/10 bg-white/5 text-neutral-400 hover:text-white transition-all cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                    <input
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="e.g. 2024-10-31 or 2025 or TBD"
                      className="w-full rounded-2xl bg-[#09090c] border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all block select-text cursor-text"
                      required
                    />
                  </div>
                ) : selectedField === 'publisherNames' ? (
                  /* Publisher Controls */
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-white">
                      Suggested Publisher Name(s)
                    </label>
                    <div>
                      <span className="block text-xs font-mono text-neutral-400 mb-2">Popular publisher suggestions (click to select):</span>
                      <div className="flex flex-wrap gap-2">
                        {COMMON_PUBLISHER_SUGGESTIONS.map((pub) => (
                          <button
                            key={pub}
                            type="button"
                            onClick={() => {
                              if (!newValue.trim()) {
                                setNewValue(pub);
                              } else {
                                const list = newValue.split(',').map((s) => s.trim()).filter(Boolean);
                                if (!list.some((s) => s.toLowerCase() === pub.toLowerCase())) {
                                  setNewValue([...list, pub].join(', '));
                                }
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-mono border border-white/10 bg-white/5 text-neutral-300 hover:text-white hover:border-white/30 transition-all cursor-pointer"
                          >
                            {pub}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="e.g. Puppet Combo, DreadXP or Self-Published"
                      className="w-full rounded-2xl bg-[#09090c] border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all block select-text cursor-text"
                      required
                    />
                  </div>
                ) : selectedField === 'genreNames' ? (
                  /* Horror Styles & Sub-genres Toggle Chips */
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-white">
                      Select Horror Sub-Genres & Styles
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {HORROR_GENRE_PRESETS.map((genre) => {
                        const selected = isCommaItemSelected(genre);
                        return (
                          <button
                            key={genre}
                            type="button"
                            onClick={() => toggleCommaItem(genre)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all border cursor-pointer flex items-center gap-1.5 ${
                              selected
                                ? 'bg-white text-black font-bold border-white'
                                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {selected && <Check className="w-3 h-3 text-black" />}
                            <span>{genre}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-1">
                      <span className="block text-xs font-mono text-neutral-400">Or type custom styles (comma-separated):</span>
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="text"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder="e.g. Psychological Horror, Found Footage, Analog Horror"
                        className="w-full rounded-2xl bg-[#09090c] border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all block select-text cursor-text"
                        required
                      />
                    </div>
                  </div>
                ) : selectedField === 'multiplayer' ? (
                  /* Game Modes (Solo / Co-Op) */
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-white">
                      Game Modes & Multiplayer
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {MULTIPLAYER_PRESETS.map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setNewValue(mode)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-mono transition-all border cursor-pointer ${
                            newValue === mode
                              ? 'bg-white text-black font-bold border-white'
                              : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                    <input
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="e.g. Single-Player Only or Online Co-Op (1-4 Players)"
                      className="w-full rounded-2xl bg-[#09090c] border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all block select-text cursor-text"
                      required
                    />
                  </div>
                ) : selectedField === 'controllerSupport' ? (
                  /* Controller Support */
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-white">
                      Controller Support
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CONTROLLER_PRESETS.map((ctrl) => (
                        <button
                          key={ctrl}
                          type="button"
                          onClick={() => setNewValue(ctrl)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-mono transition-all border cursor-pointer ${
                            newValue === ctrl
                              ? 'bg-white text-black font-bold border-white'
                              : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {ctrl}
                        </button>
                      ))}
                    </div>
                    <input
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="e.g. Full Controller Support or Partial Controller Support"
                      className="w-full rounded-2xl bg-[#09090c] border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all block select-text cursor-text"
                      required
                    />
                  </div>
                ) : selectedField === 'vrSupport' ? (
                  /* VR Support */
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-white">
                      VR (Virtual Reality) Support
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {VR_PRESETS.map((vr) => (
                        <button
                          key={vr}
                          type="button"
                          onClick={() => setNewValue(vr)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-mono transition-all border cursor-pointer ${
                            newValue === vr
                              ? 'bg-white text-black font-bold border-white'
                              : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {vr}
                        </button>
                      ))}
                    </div>
                    <input
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="e.g. Standard Screen (No VR), VR Supported, or VR Only"
                      className="w-full rounded-2xl bg-[#09090c] border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all block select-text cursor-text"
                      required
                    />
                  </div>
                ) : selectedField === 'playerWarnings' ? (
                  /* Safety & Content Warnings */
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-white">
                      Content & Safety Warnings
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SAFETY_WARNING_PRESETS.map((warn) => {
                        const selected = isCommaItemSelected(warn);
                        return (
                          <button
                            key={warn}
                            type="button"
                            onClick={() => toggleCommaItem(warn)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all border cursor-pointer flex items-center gap-1.5 ${
                              selected
                                ? 'bg-white text-black font-bold border-white'
                                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {selected && <Check className="w-3 h-3 text-black" />}
                            <span>{warn}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-1">
                      <span className="block text-xs font-mono text-neutral-400">Or type custom warnings (comma-separated):</span>
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="text"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder="e.g. Flashing Lights, Spiders, Extreme Gore"
                        className="w-full rounded-2xl bg-[#09090c] border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all block select-text cursor-text"
                        required
                      />
                    </div>
                  </div>
                ) : selectedField === 'platformNames' ? (
                  /* Interactive Platform Checkboxes */
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-white">
                      Select Supported Platforms
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {AVAILABLE_PLATFORMS.map((plat) => {
                        const isChecked = currentSelectedPlatforms.includes(plat);
                        return (
                          <button
                            key={plat}
                            type="button"
                            onClick={() => togglePlatform(plat)}
                            className={`p-3 rounded-2xl border text-xs font-mono text-left transition-all flex items-center justify-between cursor-pointer ${
                              isChecked
                                ? 'bg-white/10 border-white text-white font-bold'
                                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:border-white/20'
                            }`}
                          >
                            <span>{plat}</span>
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                              isChecked ? 'bg-white border-white text-black' : 'border-white/20 bg-transparent'
                            }`}>
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="hidden"
                      value={newValue}
                      required
                    />
                  </div>
                ) : selectedField === 'protonDbTier' ? (
                  /* ProtonDB Auto Fetch & Tier Selector */
                  <div className="space-y-4">
                    {/* Auto Fetch Card */}
                    <div className="p-4 rounded-2xl bg-[#09090c] border border-white/15 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Auto Fetch from ProtonDB</span>
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">via Official ProtonDB API</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={steamInput}
                          onChange={(e) => setSteamInput(e.target.value)}
                          placeholder="Enter Steam App ID (e.g. 594330)..."
                          className="flex-1 rounded-xl bg-white/5 border border-white/10 p-3 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30"
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
                ) : selectedField === 'purchaseLink' ? (
                  /* Dedicated Wrong Purchase Link Tool */
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-white">
                        Report or Fix Store Purchase Link
                      </label>
                      <p className="text-xs text-neutral-400">
                        Help fix broken, mismatched, or missing storefront links for this game.
                      </p>
                    </div>

                    {/* Existing Store Links if available */}
                    {gameData.purchaseLinks && gameData.purchaseLinks.length > 0 && (
                      <div className="p-4 rounded-2xl bg-[#09090c] border border-white/15 space-y-2.5">
                        <span className="block text-[11px] font-mono uppercase font-bold text-neutral-400 tracking-wider">
                          Currently Listed Store Links
                        </span>
                        <div className="space-y-1.5">
                          {gameData.purchaseLinks.map((link, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="font-bold text-white shrink-0">{link.storeName}</span>
                                <span className="text-neutral-400 font-mono text-[11px] truncate">
                                  {link.url}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const match = STORE_OPTIONS.find(
                                    (s) => s.toLowerCase() === link.storeName.toLowerCase()
                                  ) || 'Other Store';
                                  setSelectedStore(match);
                                  setLinkIssueType('Wrong Game / Mismatched');
                                  setNewValue(formatPurchaseLinkProposal(match, 'Wrong Game / Mismatched', customStoreUrl));
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold shrink-0 cursor-pointer transition-colors"
                              >
                                Select Store
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Store Selector */}
                    <div className="space-y-2">
                      <span className="block text-xs font-mono text-neutral-400">1. Select Store:</span>
                      <div className="flex flex-wrap gap-2">
                        {STORE_OPTIONS.map((store) => (
                          <button
                            key={store}
                            type="button"
                            onClick={() => {
                              setSelectedStore(store);
                              setNewValue(formatPurchaseLinkProposal(store, linkIssueType, customStoreUrl));
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer ${
                              selectedStore === store
                                ? 'bg-white text-black border-white'
                                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {store}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Issue Type Selector */}
                    <div className="space-y-2">
                      <span className="block text-xs font-mono text-neutral-400">2. Issue Type:</span>
                      <div className="flex flex-wrap gap-2">
                        {LINK_ISSUE_TYPES.map((issue) => (
                          <button
                            key={issue}
                            type="button"
                            onClick={() => {
                              setLinkIssueType(issue);
                              setNewValue(formatPurchaseLinkProposal(selectedStore, issue, customStoreUrl));
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
                              linkIssueType === issue
                                ? 'bg-white/20 border-white text-white font-bold'
                                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {issue}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Correct Store URL Input */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-mono text-neutral-400">
                        3. Correct Store URL {linkIssueType === 'Broken / Dead Link (404)' ? '(Optional if link is dead)' : '(Required)'}:
                      </label>
                      <input
                        type="url"
                        value={customStoreUrl}
                        onChange={(e) => {
                          setCustomStoreUrl(e.target.value);
                          setNewValue(formatPurchaseLinkProposal(selectedStore, linkIssueType, e.target.value));
                        }}
                        placeholder={
                          selectedStore === 'Steam'
                            ? 'https://store.steampowered.com/app/12345...'
                            : selectedStore === 'itch.io'
                            ? 'https://creator.itch.io/gamename'
                            : selectedStore === 'GOG'
                            ? 'https://www.gog.com/en/game/...'
                            : 'https://...'
                        }
                        className="w-full rounded-2xl bg-[#09090c] border border-white/20 focus:border-white p-3.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all block select-text cursor-text"
                        required={linkIssueType !== 'Broken / Dead Link (404)'}
                      />
                    </div>

                    {/* Formatted Preview */}
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] font-mono text-neutral-400 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-neutral-500 block">Proposal Payload Preview:</span>
                      <span className="text-white break-all block">{newValue || '(Configure options above)'}</span>
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
                    placeholder="e.g. Official developer update, verified store link..."
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
