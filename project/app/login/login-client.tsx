"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { firebase, getFirebaseAuth } from "@/lib/firebase/client";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleGoogleLogin = async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const auth = getFirebaseAuth();
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      await auth.signInWithPopup(provider);
      const callbackUrl = searchParams?.get("callbackUrl") ?? "/";
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in. Please try again.";
      setError(message);
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto h-16 w-16">
            <Image
              src="/careermaps-logo.png"
              alt="Careermaps logo"
              width={64}
              height={64}
              className="object-contain"
              priority
            />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-semibold">Use your Google account</CardTitle>
            <CardDescription>Sign in with Google to access the analytics dashboard</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <Button className="w-full" onClick={handleGoogleLogin} disabled={isAuthenticating}>
            {isAuthenticating ? "Connecting to Google..." : "Continue with Google"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
