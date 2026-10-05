import React, { useEffect, useState } from 'react';
import { WhatsAppTemplate } from '../types/crm';
import { collection, db, onSnapshot, createFirestoreDoc } from '../lib/firebase';
import { Plus } from 'lucide-react';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'UTILITY' | 'MARKETING' | 'AUTHENTICATION'>('UTILITY');
  const [headerText, setHeaderText] = useState('');
  const [bodyText, setBodyText] = useState('Hello {{1}}, ');
  const [footerText, setFooterText] = useState('Vtiger Enterprise CRM');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'templates'), (snap) => {
      const list = snap.docs.map((d: any) => d.data() as WhatsAppTemplate);
      setTemplates(list);
    });
    return unsub;
  }, []);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedName = name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');

    await createFirestoreDoc('templates', {
      id: `tpl_${Date.now()}`,
      name: formattedName || `hsm_template_${Date.now()}`,
      language: 'en',
      category,
      status: 'APPROVED',
      headerText,
      bodyText,
      footerText,
      variables: ['customer_name']
    });

    setShowModal(false);
    setName('');
    setHeaderText('');
    setBodyText('Hello {{1}}, ');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Meta WhatsApp HSM Templates
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pre-approved message templates required for outbound initiation when the 24-hour Customer Care Window is expired
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-1.5"
          >
            <Plus size={15} />
            Register HSM Template
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-slate-900">
                    {tpl.name}
                  </span>
                  <span className="text-slate-500">
                    {tpl.category} · {tpl.language.toUpperCase()} ·{' '}
                    <span className="text-emerald-700 font-medium">
                      {tpl.status}
                    </span>
                  </span>
                </div>

                {tpl.headerText && (
                  <div className="text-xs font-semibold text-slate-800 pt-1">
                    {tpl.headerText}
                  </div>
                )}

                <p className="text-xs text-slate-600 leading-relaxed">
                  {tpl.bodyText}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Footer: {tpl.footerText || 'None'}</span>
                <span className="font-mono">Variables: {tpl.variables.join(', ')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Register Meta HSM Template
            </h3>
            <form onSubmit={handleCreateTemplate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Template Identifier (snake_case)
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="sla_escalation_notice"
                  className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded bg-white"
                >
                  <option value="UTILITY">UTILITY</option>
                  <option value="MARKETING">MARKETING</option>
                  <option value="AUTHENTICATION">AUTHENTICATION</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Header Text
                </label>
                <input
                  type="text"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  placeholder="Enterprise Account Notice"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Body Text (Use {'{{1}}'} for Customer Name)
                </label>
                <textarea
                  required
                  rows={3}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Footer Text
                </label>
                <input
                  type="text"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700"
                >
                  Approve & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
