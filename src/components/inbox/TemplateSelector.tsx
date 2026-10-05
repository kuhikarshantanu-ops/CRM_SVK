import React, { useEffect, useState } from 'react';
import { WhatsAppTemplate } from '../../types/crm';
import { collection, db, onSnapshot } from '../../lib/firebase';
import { X } from 'lucide-react';

interface TemplateSelectorProps {
  customerName: string;
  onSelectTemplate: (templateName: string, language: string) => Promise<void>;
  onClose: () => void;
}

export default function TemplateSelector({
  customerName,
  onSelectTemplate,
  onClose
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'templates'), (snap) => {
      const list = snap.docs
        .map((d: any) => d.data() as WhatsAppTemplate)
        .filter((t: WhatsAppTemplate) => t.status === 'APPROVED');
      setTemplates(list);
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id);
      }
    });
    return unsub;
  }, []);

  const activeTemplate = templates.find((t) => t.id === selectedId);

  const handleDispatch = async () => {
    if (!activeTemplate || sending) return;
    setSending(true);
    try {
      await onSelectTemplate(activeTemplate.name, activeTemplate.language);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full overflow-hidden shadow-lg">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Dispatch Approved Meta HSM Template
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bypasses expired 24-hour Customer Care Window per Meta Graph v21.0 policy
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Select Approved Template
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedId(tpl.id)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    tpl.id === selectedId
                      ? 'border-emerald-600 bg-emerald-50/40'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-slate-900">
                      {tpl.name}
                    </span>
                    <span className="text-slate-500">
                      {tpl.category} · {tpl.language.toUpperCase()} · {tpl.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {tpl.bodyText.replace('{{1}}', customerName)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {activeTemplate && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1">
              <div className="text-[11px] font-medium text-slate-500">
                Rendered Preview for {customerName}
              </div>
              {activeTemplate.headerText && (
                <div className="text-xs font-semibold text-slate-800">
                  {activeTemplate.headerText}
                </div>
              )}
              <p className="text-xs text-slate-700 leading-relaxed">
                {activeTemplate.bodyText.replace('{{1}}', customerName)}
              </p>
              {activeTemplate.footerText && (
                <div className="text-[11px] text-slate-400 pt-1">
                  {activeTemplate.footerText}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDispatch}
            disabled={!activeTemplate || sending}
            className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-slate-300 whitespace-nowrap"
          >
            {sending ? 'Dispatching HSM...' : 'Send Approved Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
