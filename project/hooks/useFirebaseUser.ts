"use client";

import { useEffect, useState } from "react";
import type firebase from "firebase/compat/app";
import { getFirebaseAuth, shouldBypassFirebaseAuth } from "@/lib/firebase/client";

interface AuthState {
  user: firebase.User | null;
  loading: boolean;
}

export function useFirebaseUser(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    if (shouldBypassFirebaseAuth()) {
      setState({ user: null, loading: false });
      return;
    }

    const auth = getFirebaseAuth();
    const unsubscribe = auth.onAuthStateChanged((nextUser) => {
      setState({ user: nextUser, loading: false });
    });

    return () => unsubscribe();
  }, []);

  return state;
}
