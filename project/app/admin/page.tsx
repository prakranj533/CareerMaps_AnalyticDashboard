import dynamic from "next/dynamic";

const AuthGuard = dynamic(() => import("@/components/auth-guard"), { ssr: false });

const AdminClient = dynamic(() => import("./admin-client"), { ssr: false });

export default function Page() {
  return (
    <AuthGuard>
      <AdminClient />
    </AuthGuard>
  );
}
