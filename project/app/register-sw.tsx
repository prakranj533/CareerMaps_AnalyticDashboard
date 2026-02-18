'use client';

import { useEffect } from 'react';

export function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if ('serviceWorker' in navigator) {
      const registerServiceWorker = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          if (process.env.NODE_ENV === 'development') {
            console.info('[ServiceWorker] registered:', registration.scope);
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[ServiceWorker] registration failed:', error);
          }
        }
      };

      registerServiceWorker();
    }
  }, []);

  return null;
}
