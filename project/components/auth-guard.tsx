"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useFirebaseUser } from "@/hooks/useFirebaseUser";
import { shouldBypassFirebaseAuth } from "@/lib/firebase/client";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useFirebaseUser();
  const authBypassed = shouldBypassFirebaseAuth();

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

  return <>{children}</>;
}
