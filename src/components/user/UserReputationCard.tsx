import React, { useState, useEffect } from 'react';
import { ShieldCheck, Award, CheckCircle2, XCircle, Zap, Loader2 } from 'lucide-react';
import type { ReputationInfo } from '../../lib/userReputation';

interface UserReputationCardProps {
  userId: string;
}

export const UserReputationCard: React.FC<UserReputationCardProps> = ({ userId }) => {
  const [rep, setRep] = useState<ReputationInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/user/reputation?userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          setRep(data.reputation);
        }
      } catch (e) {
        console.warn('Failed to load user reputation card:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
        <span>Loading contributor profile...</span>
      </div>
    );
  }

  if (!rep) return null;

  const isTrusted = rep.tier === 'tier_1_trusted' || rep.tier === 'tier_2_moderator';

  return (
    <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/80 space-y-4 text-zinc-100">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl border ${
            isTrusted 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-zinc-800/80 border-zinc-700/50 text-zinc-400'
          }`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold flex items-center gap-1.5">
              <span>{isTrusted ? 'Trusted Editor' : 'Community Contributor'}</span>
              {isTrusted && <Zap className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />}
            </h4>
            <p className="text-[11px] text-zinc-400">
              {isTrusted ? 'Low-risk edits auto-publish' : 'Edits queued for moderation'}
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-red-400">
          {Math.round(rep.accuracyScore * 100)}% Accuracy
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="block font-bold text-zinc-200 text-sm">{rep.totalApproved}</span>
          <span className="text-[10px] text-zinc-500 uppercase font-semibold">Approved</span>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="block font-bold text-zinc-200 text-sm">{rep.totalSubmitted}</span>
          <span className="text-[10px] text-zinc-500 uppercase font-semibold">Submitted</span>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="block font-bold text-zinc-200 text-sm">{rep.totalRejected}</span>
          <span className="text-[10px] text-zinc-500 uppercase font-semibold">Rejected</span>
        </div>
      </div>

      {rep.badges && rep.badges.length > 0 && (
        <div className="pt-1 flex flex-wrap gap-1.5">
          {rep.badges.map((badge, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] font-semibold"
            >
              <Award className="w-3 h-3 text-red-400" />
              {badge}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
