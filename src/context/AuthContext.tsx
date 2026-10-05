import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole } from '../types/crm';
import { collection, db, onSnapshot } from '../lib/firebase';

interface AuthContextValue {
  user: UserProfile | null;
  users: UserProfile[];
  workspaceId: string;
  switchUser: (uid: string) => void;
  switchRole: (role: UserRole) => void;
  logout: () => void;
  loginWithEmail: (email: string) => boolean;
}

const DEFAULT_USER: UserProfile = {
  uid: 'usr_admin_01',
  workspaceId: 'ws_enterprise_hq',
  email: 'arjun.mehta@vtiger-enterprise.io',
  displayName: 'Arjun Mehta',
  role: 'ADMIN',
  active: true,
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const AuthContext = createContext<AuthContextValue>({
  user: DEFAULT_USER,
  users: [DEFAULT_USER],
  workspaceId: 'ws_enterprise_hq',
  switchUser: () => {},
  switchRole: () => {},
  logout: () => {},
  loginWithEmail: () => true
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<UserProfile[]>([DEFAULT_USER]);
  const [currentUid, setCurrentUid] = useState<string>('usr_admin_01');
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map((d: any) => d.data() as UserProfile);
      if (list.length > 0) {
        setUsers(list);
      }
    });
    return unsub;
  }, []);

  const activeUser = isLoggedOut
    ? null
    : users.find((u) => u.uid === currentUid) || users[0] || DEFAULT_USER;

  const switchUser = (uid: string) => {
    setIsLoggedOut(false);
    setCurrentUid(uid);
  };

  const switchRole = (role: UserRole) => {
    const match = users.find((u) => u.role === role);
    if (match) {
      setIsLoggedOut(false);
      setCurrentUid(match.uid);
    }
  };

  const logout = () => {
    setIsLoggedOut(true);
  };

  const loginWithEmail = (email: string) => {
    const match = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase().trim()
    );
    if (match) {
      setCurrentUid(match.uid);
      setIsLoggedOut(false);
      return true;
    }
    setCurrentUid('usr_admin_01');
    setIsLoggedOut(false);
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user: activeUser,
        users,
        workspaceId: activeUser?.workspaceId || 'ws_enterprise_hq',
        switchUser,
        switchRole,
        logout,
        loginWithEmail
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
