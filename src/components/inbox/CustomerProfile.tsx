import React, { useEffect, useState } from 'react';
import { Conversation, VtigerRecord, UserProfile } from '../../types/crm';
import {
  collection,
  db,
  onSnapshot,
  updateFirestoreDoc
} from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';

interface CustomerProfileProps {
  conversation: Conversation;
}

export default function CustomerProfile({ conversation }: CustomerProfileProps) {
  const { users } = useAuth();
  const [crmRecord, setCrmRecord] = useState<VtigerRecord | null>(null);
  const [creatingLead, setCreatingLead] = useState(false);
  const [companyInput, setCompanyInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vtigerRecords'), (snap) => {
      const records = snap.docs.map((d: any) => d.data() as VtigerRecord);
      const found = records.find(
        (r: VtigerRecord) =>
          r.compoundId === conversation.crmRecordId ||
          r.mobile === conversation.normalizedPhoneNumber ||
          r.phone === conversation.phoneNumber
      );
      setCrmRecord(found || null);
      if (found?.notes !== undefined) {
        setNotesInput(found.notes);
      }
    });
    return unsub;
  }, [
    conversation.crmRecordId,
    conversation.normalizedPhoneNumber,
    conversation.phoneNumber
  ]);

  const handleAssignAgent = async (userId: string) => {
    await updateFirestoreDoc('conversations', conversation.id, {
      assignedUserId: userId || null
    });
  };

  const handleCreateVtigerLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingLead(true);
    try {
      const parts = conversation.customerName.trim().split(' ');
      await fetch('/api/demo/create-vtiger-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          firstName: parts[0] || 'WhatsApp',
          lastName: parts.slice(1).join(' ') || conversation.normalizedPhoneNumber,
          email: emailInput || `${conversation.normalizedPhoneNumber}@prospect.in`,
          company: companyInput || 'Enterprise Prospect'
        })
      });
    } finally {
      setCreatingLead(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!crmRecord) return;
    setSavingNotes(true);
    try {
      await updateFirestoreDoc('vtigerRecords', crmRecord.compoundId, {
        notes: notesInput
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleConvertToContact = async () => {
    if (!crmRecord || crmRecord.moduleName === 'Contacts') return;
    const newCompoundId = `12x${crmRecord.recordId}`;
    await updateFirestoreDoc('vtigerRecords', crmRecord.compoundId, {
      compoundId: newCompoundId,
      moduleId: '12',
      moduleName: 'Contacts',
      leadStatus: 'Converted'
    });
    await updateFirestoreDoc('conversations', conversation.id, {
      crmRecordId: newCompoundId,
      crmRecordType: 'CONTACT'
    });
  };

  return (
    <aside className="w-80 border-l border-slate-200 bg-white flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">
          Vtiger CRM Inspector
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          WebServices VQL & Compound Entity Resolution
        </p>
      </div>

      <div className="p-4 border-b border-slate-200 space-y-3">
        <div>
          <div className="text-xs text-slate-500">Customer Name</div>
          <div className="text-sm font-semibold text-slate-900 mt-0.5">
            {conversation.customerName}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-500">E.164 Canonical</div>
            <div className="text-xs font-mono tabular-nums text-slate-800 mt-0.5">
              {conversation.phoneNumber}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">10-Digit National</div>
            <div className="text-xs font-mono tabular-nums text-slate-800 mt-0.5">
              {conversation.normalizedPhoneNumber}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">
            Assigned Workspace Agent
          </label>
          <select
            value={conversation.assignedUserId || ''}
            onChange={(e) => handleAssignAgent(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-emerald-600"
          >
            <option value="">Unassigned</option>
            {users.map((u: UserProfile) => (
              <option key={u.uid} value={u.uid}>
                {u.displayName} ({u.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {crmRecord ? (
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Vtiger Compound ID</span>
              <span className="font-mono font-semibold text-emerald-700">
                {crmRecord.compoundId} ({crmRecord.moduleName})
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Module Prefix</span>
              <span className="font-mono text-slate-700">
                {crmRecord.moduleId}x ({crmRecord.moduleName === 'Contacts' ? 'Contacts' : 'Leads'})
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Organization</span>
              <span className="text-slate-800 font-medium truncate max-w-[160px]">
                {crmRecord.company || 'Enterprise Account'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Email</span>
              <span className="font-mono text-slate-700 truncate max-w-[170px]">
                {crmRecord.email || '—'}
              </span>
            </div>
            {crmRecord.dealValue !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Pipeline Value</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  ${crmRecord.dealValue.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Vtiger CRM Notes
            </label>
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              rows={3}
              className="w-full p-2 text-xs border border-slate-200 rounded bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-emerald-600"
              placeholder="Add call notes or Vtiger sync metadata..."
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800"
              >
                {savingNotes ? 'Syncing...' : 'Sync Notes to Vtiger'}
              </button>

              {crmRecord.moduleName === 'Leads' && (
                <button
                  type="button"
                  onClick={handleConvertToContact}
                  className="px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-300 rounded hover:bg-emerald-50"
                >
                  Convert to Contact (12x)
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreateVtigerLead} className="p-4 space-y-3">
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded text-xs text-amber-900">
            No matching Contact (12x) or Lead (10x) found in Vtiger CRM for{' '}
            <span className="font-mono">{conversation.normalizedPhoneNumber}</span>.
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Company / Organization
            </label>
            <input
              type="text"
              value={companyInput}
              onChange={(e) => setCompanyInput(e.target.value)}
              placeholder="e.g. Infosys FinTech"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Work Email
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="prospect@company.com"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-600"
            />
          </div>

          <button
            type="submit"
            disabled={creatingLead}
            className="w-full py-2 px-4 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-slate-300"
          >
            {creatingLead
              ? 'Creating Vtiger Lead...'
              : 'Create Vtiger Lead (10x)'}
          </button>
        </form>
      )}
    </aside>
  );
}
