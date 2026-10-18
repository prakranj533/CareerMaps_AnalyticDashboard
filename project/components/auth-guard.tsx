"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccessGate } from "@/hooks/useAccessGate";
import { getFirebaseAuth, shouldBypassFirebaseAuth } from "@/lib/firebase/client";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, approved, accessError } = useAccessGate();
  const authBypassed = shouldBypassFirebaseAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const callbackUrl = useMemo(() => {
    if (!pathname || pathname === "/") return "/";
    return pathname;
  }, [pathname]);

  useEffect(() => {
    if (!authBypassed && !loading && !user) {
      const search = callbackUrl && callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : "";
      router.replace(`/login${search}`);
    }
  }, [authBypassed, loading, user, callbackUrl, router]);

  if (authBypassed) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="animate-spin h-6 w-6" />
        <p>Checking your session…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldCheck className="h-10 w-10 mx-auto text-amber-500" />
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-slate-900">Approval pending</h1>
              <p className="text-sm text-slate-500">
                {user.email
                  ? `Your login (${user.email}) is waiting for admin review. You'll get access once it's approved.`
                  : 'Your login is waiting for admin review.'}
              </p>
              {accessError && (
                <p className="text-xs text-rose-600 pt-1">Access check failed: {accessError}</p>
              )}
            </div>
            <Button
              variant="outline"
              className="gap-2"
              disabled={isSigningOut}
              onClick={async () => {
                try {
                  setIsSigningOut(true);
                  const auth = await getFirebaseAuth();
                  await auth.signOut();
                  router.push('/login');
                  router.refresh();
                } catch {
                  setIsSigningOut(false);
                }
              }}
            >
              <LogOut className="h-4 w-4" />
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
