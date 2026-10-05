import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import InboxPage from './pages/InboxPage';
import LeadsPage from './pages/LeadsPage';
import ContactsPage from './pages/ContactsPage';
import TemplatesPage from './pages/TemplatesPage';
import SystemHealthPage from './pages/SystemHealthPage';
import SettingsPage from './pages/SettingsPage';
import Login from './pages/Login';
import DemoSandboxModal from './components/demo/DemoSandboxModal';

type ActiveTab =
  | 'INBOX'
  | 'LEADS'
  | 'CONTACTS'
  | 'TEMPLATES'
  | 'HEALTH'
  | 'SETTINGS';

function EnterpriseWorkspaceShell() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('INBOX');
  const [phoneFilter, setPhoneFilter] = useState<string | null>(null);
  const [showGlobalDemoModal, setShowGlobalDemoModal] = useState(false);

  if (!user) {
    return <Login />;
  }

  const handleOpenChatForPhone = (phone: string) => {
    setPhoneFilter(phone);
    setActiveTab('INBOX');
  };

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'INBOX', label: 'Inbox' },
    { id: 'LEADS', label: 'Leads' },
    { id: 'CONTACTS', label: 'Contacts' },
    { id: 'TEMPLATES', label: 'Templates' },
    { id: 'HEALTH', label: 'System Health' },
    { id: 'SETTINGS', label: 'Settings' }
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden">
      <header className="h-14 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <a
          href="#inbox"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('INBOX');
          }}
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap"
        >
          Vtiger WhatsApp CRM
        </a>

        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-4 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-emerald-600 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowGlobalDemoModal(true)}
            className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors whitespace-nowrap"
          >
            Demo Simulator
          </button>
          <button
            type="button"
            onClick={logout}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md whitespace-nowrap"
            title={`Signed in as ${user.displayName} (${user.role})`}
          >
            {user.displayName} · {user.role}
          </button>
        </div>
      </header>

      {activeTab === 'INBOX' && (
        <InboxPage initialPhoneFilter={phoneFilter} />
      )}
      {activeTab === 'LEADS' && (
        <LeadsPage onOpenChat={handleOpenChatForPhone} />
      )}
      {activeTab === 'CONTACTS' && (
        <ContactsPage onOpenChat={handleOpenChatForPhone} />
      )}
      {activeTab === 'TEMPLATES' && <TemplatesPage />}
      {activeTab === 'HEALTH' && <SystemHealthPage />}
      {activeTab === 'SETTINGS' && <SettingsPage />}

      {showGlobalDemoModal && (
        <DemoSandboxModal onClose={() => setShowGlobalDemoModal(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <EnterpriseWorkspaceShell />
    </AuthProvider>
  );
}
