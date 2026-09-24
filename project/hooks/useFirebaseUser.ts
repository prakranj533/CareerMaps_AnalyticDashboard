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

    let active = true;
    let unsubscribe: (() => void) | undefined;

    getFirebaseAuth()
      .then((auth) => {
        if (!active) return;
        unsubscribe = auth.onAuthStateChanged((nextUser) => {
          setState({ user: nextUser, loading: false });
        });
      })
      .catch(() => {
        if (active) setState({ user: null, loading: false });
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return state;
}
