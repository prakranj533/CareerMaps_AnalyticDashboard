import dynamic from "next/dynamic";

const LoginClient = dynamic(() => import("./login-client"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      Loading sign-in…
    </div>
  ),
});

export default function LoginPage() {
  return <LoginClient />;
}
