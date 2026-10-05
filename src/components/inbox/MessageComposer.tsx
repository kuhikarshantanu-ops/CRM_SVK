import React, { useState, useRef } from 'react';
import { use24hWindow } from '../../hooks/use24hWindow';
import { Send } from 'lucide-react';
import TemplateSelector from './TemplateSelector';

interface MessageComposerProps {
  conversationId: string;
  customerName: string;
  onSend: (text: string) => Promise<void>;
  onSendTemplate: (templateName: string, language: string) => Promise<void>;
}

export default function MessageComposer({
  conversationId,
  customerName,
  onSend,
  onSendTemplate
}: MessageComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { isInsideWindow, expiresIn, isExpired } =
    use24hWindow(conversationId);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !sending) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;

    setSending(true);
    setErrorBanner(null);
    try {
      await onSend(text);
      setText('');
      inputRef.current?.focus();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to dispatch message');
    } finally {
      setSending(false);
    }
  };

  const handleToggleWindowDemo = async (mode: 'expire' | 'restore') => {
    await fetch('/api/demo/toggle-csw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, mode })
    });
  };

  const hoursRemaining = Math.floor(expiresIn / (60 * 60 * 1000));
  const minsRemaining = Math.floor((expiresIn % (60 * 60 * 1000)) / (60 * 1000));
  const secsRemaining = Math.floor((expiresIn % (60 * 1000)) / 1000);

  return (
    <>
      <div className="border-t border-slate-200 p-4 bg-white">
        {errorBanner && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center justify-between">
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="underline font-medium ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {isExpired ? (
          <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                24-Hour Customer Care Window Expired (HTTP 422 Enforcement)
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Free-form TEXT dispatch is locked by zero-trust policy. Dispatch an approved Meta HSM template to re-engage {customerName}.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleToggleWindowDemo('restore')}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
              >
                Simulate Inbound (Reopen 24h)
              </button>
              <button
                type="button"
                onClick={() => setShowTemplateModal(true)}
                className="px-4 py-2 text-xs font-medium bg-amber-700 text-white rounded-md hover:bg-amber-800 whitespace-nowrap"
              >
                Choose Approved Template
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="text-emerald-700 font-medium">
                  24h Customer Care Window Active
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-600">
                  {hoursRemaining}h {minsRemaining}m {secsRemaining}s remaining
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(true)}
                  className="text-xs font-medium text-emerald-700 hover:underline"
                >
                  Send HSM Template
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => handleToggleWindowDemo('expire')}
                  className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                >
                  Simulate 24h Expiry
                </button>
              </div>
            </div>

            <div className="flex gap-2.5">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isExpired || sending}
                placeholder="Type message via /api/messages/send... (Enter to send, Shift+Enter for newline)"
                className="flex-1 p-2.5 text-sm border border-slate-300 rounded-md resize-none focus:outline-none focus:border-emerald-600 disabled:bg-slate-100"
                rows={2}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!text.trim() || sending || isExpired}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-md hover:bg-emerald-700 disabled:bg-slate-300 flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Send size={15} />
                {sending ? 'Dispatching...' : 'Send Message'}
              </button>
            </div>
          </>
        )}
      </div>

      {showTemplateModal && (
        <TemplateSelector
          customerName={customerName}
          onSelectTemplate={onSendTemplate}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
    </>
  );
}
