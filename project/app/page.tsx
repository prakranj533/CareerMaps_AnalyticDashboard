import dynamic from "next/dynamic";

const AuthGuard = dynamic(() => import("@/components/auth-guard"), { ssr: false });

const Dashboard = dynamic(() => import("./dashboard-client"), { ssr: false });

export default function Page() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
