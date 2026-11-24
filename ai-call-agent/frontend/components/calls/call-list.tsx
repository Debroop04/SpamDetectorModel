import { Globe, PhoneIncoming } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPhone, statusLabel, timeAgo } from '@/lib/format';
import type { Call, Verdict } from '@/lib/types';
import { VerdictBadge } from '@/components/ui/badge';
import { RiskMeter } from '@/components/charts';

const avatarTone: Record<Verdict, string> = {
  pending: 'bg-subtle text-ink-3',
  safe: 'bg-safe-soft text-safe',
  suspicious: 'bg-warn-soft text-warn',
  spam: 'bg-danger-soft text-danger',
};

/** Round caller icon tinted by the verdict; the globe marks browser test calls. */
export function CallAvatar({ call, size = 'md' }: { call: Pick<Call, 'verdict' | 'channel'>; size?: 'sm' | 'md' }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full', size === 'sm' ? 'h-9 w-9' : 'h-10 w-10', avatarTone[call.verdict])}>
      {call.channel === 'browser' ? <Globe className="h-4 w-4" /> : <PhoneIncoming className="h-4 w-4" />}
    </span>
  );
}

export function CallListItem({ call, onClick }: { call: Call; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-subtle">
      <CallAvatar call={call} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{call.caller_name || formatPhone(call.caller_number)}</div>
        <div className="truncate text-xs text-ink-3">
          {call.category || statusLabel[call.status]} · {timeAgo(call.started_at)}
        </div>
        <div className="mt-2 max-w-48">
          <RiskMeter score={call.risk_score} size="sm" />
        </div>
      </div>
      <VerdictBadge verdict={call.verdict} live={call.status === 'screening'} />
    </button>
  );
}
