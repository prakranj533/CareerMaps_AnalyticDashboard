"use client";

import { useFirebaseUser } from '@/hooks/useFirebaseUser';
import { isAdminEmail } from '@/lib/admin';
import { shouldBypassFirebaseAuth } from '@/lib/firebase/client';

export function useIsAdmin() {
  const { user, loading } = useFirebaseUser();
  const bypassed = shouldBypassFirebaseAuth();
  return {
    // Dev bypass (no Firebase config) is treated as admin so local runs show everything
    isAdmin: bypassed || isAdminEmail(user?.email),
    loading: bypassed ? false : loading,
    user,
  };
}
