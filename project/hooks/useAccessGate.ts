"use client";

import { useEffect, useState } from 'react';
import { useFirebaseUser } from '@/hooks/useFirebaseUser';
import { isAdminEmail } from '@/lib/admin';
import { recordLogin, subscribeToAccess, type UserAccessDoc } from '@/lib/access';
import { shouldBypassFirebaseAuth } from '@/lib/firebase/client';

const SESSION_FLAG = 'cm_login_recorded';

export interface AccessGateState {
  user: ReturnType<typeof useFirebaseUser>['user'];
  loading: boolean;
  isAdmin: boolean;
  approved: boolean;
  accessDoc: UserAccessDoc | null;
  accessError: string | null;
}

export function useAccessGate(): AccessGateState {
  const { user, loading: userLoading } = useFirebaseUser();
  const bypassed = shouldBypassFirebaseAuth();
  const [state, setState] = useState<Omit<AccessGateState, 'user' | 'isAdmin' | 'approved'>>({
    loading: true,
    accessDoc: null,
    accessError: null,
  });

  const email = user?.email ?? null;
  const admin = isAdminEmail(email);

  useEffect(() => {
    if (bypassed) {
      setState({ loading: false, accessDoc: null, accessError: null });
      return;
    }
    if (userLoading) return;
    if (!email) {
      setState({ loading: false, accessDoc: null, accessError: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, accessError: null }));

    // Record the login once per browser session
    if (typeof window !== 'undefined' && !window.sessionStorage.getItem(SESSION_FLAG)) {
      window.sessionStorage.setItem(SESSION_FLAG, '1');
      if (user) {
        recordLogin(user).catch((err) => console.error('Failed to record login', err));
      }
    }

    const unsubscribe = subscribeToAccess(
      email,
      (doc) => setState({ loading: false, accessDoc: doc, accessError: null }),
      (err) => setState({ loading: false, accessDoc: null, accessError: err.message }),
    );
    return unsubscribe;
  }, [bypassed, userLoading, email, user]);

  const approved = bypassed || admin || state.accessDoc?.approved === true;

  return {
    user,
    loading: bypassed ? false : userLoading || (!!email && state.loading),
    isAdmin: bypassed || admin,
    approved,
    accessDoc: state.accessDoc,
    accessError: state.accessError,
  };
}
