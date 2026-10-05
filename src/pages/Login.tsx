import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { users, switchUser, loginWithEmail } = useAuth();
  const [email, setEmail] = useState('arjun.mehta@vtiger-enterprise.io');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginWithEmail(email);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            Vtiger WhatsApp CRM
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Zero-Trust Multi-Tenant Enterprise Workspace (`ws_enterprise_hq`)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Operator Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-600"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            Sign In to Workspace
          </button>
        </form>

        <div className="pt-4 border-t border-slate-200 space-y-2">
          <div className="text-xs font-medium text-slate-600">
            Instant Demo Role Access
          </div>
          <div className="space-y-1.5">
            {users.map((u) => (
              <button
                key={u.uid}
                type="button"
                onClick={() => switchUser(u.uid)}
                className="w-full text-left px-3 py-2 text-xs border border-slate-200 rounded hover:bg-slate-50 flex items-center justify-between"
              >
                <span className="font-medium text-slate-800">
                  {u.displayName} ({u.email})
                </span>
                <span className="font-mono text-emerald-700 font-semibold">
                  {u.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
