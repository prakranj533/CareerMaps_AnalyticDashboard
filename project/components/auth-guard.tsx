"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useFirebaseUser } from "@/hooks/useFirebaseUser";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useFirebaseUser();

  const callbackUrl = useMemo(() => {
    if (!pathname || pathname === "/") return "/";
    return pathname;
  }, [pathname]);

  useEffect(() => {
    if (!loading && !user) {
      const search = callbackUrl && callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : "";
      router.replace(`/login${search}`);
    }
  }, [loading, user, callbackUrl, router]);

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
