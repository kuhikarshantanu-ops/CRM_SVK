import React, { useEffect, useState } from 'react';
import { VtigerRecord } from '../types/crm';
import { collection, db, onSnapshot, createFirestoreDoc } from '../lib/firebase';
import { Search, Plus } from 'lucide-react';

interface ContactsPageProps {
  onOpenChat: (phone: string) => void;
}

export default function ContactsPage({ onOpenChat }: ContactsPageProps) {
  const [contacts, setContacts] = useState<VtigerRecord[]>([]);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('+9198');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [dealValue, setDealValue] = useState('50000');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vtigerRecords'), (snap) => {
      const list = snap.docs
        .map((d: any) => d.data() as VtigerRecord)
        .filter((r: VtigerRecord) => r.moduleName === 'Contacts')
        .sort((a: VtigerRecord, b: VtigerRecord) => b.updatedAt - a.updatedAt);
      setContacts(list);
    });
    return unsub;
  }, []);

  const filtered = contacts.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.compoundId.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q)
    );
  });

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const recordId = Math.floor(500 + Math.random() * 8900).toString();
    const compoundId = `12x${recordId}`;
    const cleanDigits = mobile.replace(/[^\d]/g, '').slice(-10);
    const e164 = `+91${cleanDigits}`;

    await createFirestoreDoc('vtigerRecords', {
      compoundId,
      moduleId: '12',
      recordId,
      moduleName: 'Contacts',
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      phone: e164,
      mobile: cleanDigits,
      email,
      company,
      assignedUserId: '19x1',
      assignedUserName: 'Arjun Mehta',
      dealValue: Number(dealValue) || 50000,
      notes: 'Verified Enterprise Contact record.'
    });

    setShowCreateModal(false);
    setFirstName('');
    setLastName('');
    setMobile('+9198');
    setEmail('');
    setCompany('');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Vtiger Contacts Directory (12x Compound IDs)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Primary entity priority resolution during inbound WhatsApp webhook ingestion
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by 12x ID, name, phone..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-emerald-600"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus size={15} />
              New Vtiger Contact
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Compound ID</th>
                <th className="py-3 px-4">Contact Name</th>
                <th className="py-3 px-4">Enterprise Account</th>
                <th className="py-3 px-4">E.164 Phone</th>
                <th className="py-3 px-4">Assigned Owner</th>
                <th className="py-3 px-4 text-right">Contract ARR</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filtered.map((contact) => (
                <tr
                  key={contact.compoundId}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-semibold text-emerald-700">
                    {contact.compoundId}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">
                      {contact.fullName}
                    </div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      {contact.email}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {contact.company || 'Enterprise SLA'}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                    {contact.phone}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {contact.assignedUserName} ({contact.assignedUserId})
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                    ${(contact.dealValue || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenChat(contact.phone)}
                      className="px-3 py-1 text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Open Thread
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Create Vtiger Contact (Module 12x)
            </h3>
            <form onSubmit={handleCreateContact} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    First Name
                  </label>
                  <input
                    required
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Last Name
                  </label>
                  <input
                    required
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mobile Number (E.164)
                </label>
                <input
                  required
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Account / Company
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Annual Contract Value
                  </label>
                  <input
                    type="number"
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
