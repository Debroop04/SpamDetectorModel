import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';

export interface TranscriptLine {
  speaker: 'assistant' | 'caller';
  text: string;
  text_en: string | null;
  created_at: string;
}

/** Conversation as chat bubbles: the caller on the left, the AI assistant on the right. */
export function Transcript({ lines, live }: { lines: TranscriptLine[]; live?: boolean }) {
  if (lines.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-3">{live ? 'Waiting for the caller to speak' : 'No transcript for this call'}</p>;
  }
  return (
    <ol className="space-y-3.5">
      {lines.map((line, index) => {
        const caller = line.speaker === 'caller';
        return (
          <li
            key={`${line.created_at}-${index}`}
            className={cn('flex items-end gap-2.5', !caller && 'flex-row-reverse', live && index === lines.length - 1 && 'animate-in')}
          >
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                caller ? 'bg-muted text-ink-2' : 'bg-accent text-on-accent',
              )}
            >
              {caller ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </span>
            <div className={cn('flex max-w-[85%] min-w-0 flex-col', !caller && 'items-end')}>
              <div
                className={cn(
                  'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  caller ? 'rounded-bl-md border border-line bg-subtle text-ink' : 'rounded-br-md bg-accent-soft text-ink',
                )}
              >
                {line.text}
                {line.text_en && line.text_en !== line.text && (
                  <p className="mt-2 border-t border-line pt-2 text-[13px] leading-relaxed text-ink-3">{line.text_en}</p>
                )}
              </div>
              <span className="mt-1 px-1 text-[11px] text-ink-3">
                {caller ? 'Caller' : 'Assistant'} · {formatTime(line.created_at)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
