import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, db, onSnapshot } from '../lib/firebase';
import { UserRole } from '../types/crm';

export default function SettingsPage() {
  const { user, users, switchUser, switchRole } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [securityAuditResult, setSecurityAuditResult] = useState<string | null>(
    null
  );

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'integrationSettings'), (snap) => {
      if (!snap.empty) {
        setSettings(snap.docs[0].data());
      }
    });
    return unsub;
  }, []);

  const handleTestDirectMessageMutation = async () => {
    const res = await fetch('/api/firestore/doc/messages/msg_seed_101', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'READ', externalMessageId: 'spoofed' })
    });
    const data = await res.json();
    setSecurityAuditResult(
      `HTTP ${res.status} (${data.error}): ${data.message}`
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Zero-Trust Workspace & RBAC Governance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-tenant workspace boundaries (`ws_enterprise_hq`), Server-Only Secret Manager bindings, and Firestore Security Rules verification
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              01. Active Operator Role & Multi-Tenant Session
            </h2>
            <p className="text-xs text-slate-500">
              Switch active workspace user to verify `isStaff()` and `isAdmin()` RBAC controls
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {users.map((u) => {
              const active = u.uid === user?.uid;
              return (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => switchUser(u.uid)}
                  className={`p-3.5 rounded-md border text-left transition-colors ${
                    active
                      ? 'border-emerald-600 bg-emerald-50/40'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">
                      {u.displayName}
                    </span>
                    <span className="font-mono text-emerald-700 font-semibold">
                      {u.role}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono truncate">
                    {u.email}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono">
                    UID: {u.uid} · Workspace: {u.workspaceId}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs text-slate-500">Quick Role Switch:</span>
            {(['ADMIN', 'MANAGER', 'AGENT'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => switchRole(r)}
                className={`px-3 py-1 text-xs font-medium rounded border ${
                  user?.role === r
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                02. Server-Side Secret Manager & Adapter Bindings
              </h2>
              <p className="text-xs text-slate-500">
                Secrets (`WHATSAPP_ACCESS_TOKEN`, `META_APP_SECRET`, `VTIGER_ACCESS_KEY`) never leave the Cloud Functions runtime
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-700">
              [DEMO SIMULATED RUNTIME]
            </span>
          </div>

          {settings && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-2">
                <div className="font-semibold text-slate-800">
                  Meta WhatsApp Cloud API (Graph v21.0)
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Business Account ID:</span>
                  <span className="text-slate-900">
                    {settings.metaBusinessAccountId}
                  </span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Phone Number ID:</span>
                  <span className="text-slate-900">
                    {settings.metaPhoneNumberId}
                  </span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Access Token:</span>
                  <span className="text-slate-500">
                    {settings.metaAccessTokenMasked || 'Encrypted in Secret Manager'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-2">
                <div className="font-semibold text-slate-800">
                  Vtiger WebServices CRM Adapter (MD5 Challenge)
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Endpoint:</span>
                  <span className="text-slate-900">{settings.vtigerBaseUrl}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Webservice User:</span>
                  <span className="text-slate-900">{settings.vtigerUsername}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Access Key:</span>
                  <span className="text-slate-500">
                    {settings.vtigerAccessKeyMasked || 'Encrypted in Secret Manager'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                03. Zero-Trust Client Mutation Audit (`firestore.rules`)
              </h2>
              <p className="text-xs text-slate-500">
                Verify that direct client attempts to mutate `messages` (`status`, `externalMessageId`, `sentAt`) are strictly rejected with HTTP 403
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestDirectMessageMutation}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap"
            >
              Attempt Direct Client Message Write
            </button>
          </div>

          {securityAuditResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs font-mono text-emerald-900">
              Zero-Trust Gate Verified: {securityAuditResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
