'use client';

import { useEffect } from 'react';

export function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if ('serviceWorker' in navigator) {
      const clearStaleWorker = async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));

          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
          }

          if (navigator.serviceWorker.controller && !sessionStorage.getItem('service-worker-reset')) {
            sessionStorage.setItem('service-worker-reset', 'true');
            window.location.reload();
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[ServiceWorker] cleanup failed:', error);
          }
        }
      };

      clearStaleWorker();
    }
  }, []);

  return null;
}
