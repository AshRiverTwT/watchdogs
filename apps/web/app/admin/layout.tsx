import { AppHeader } from "@/components/app-header";
import { requireAdmin } from "@/lib/server/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main id="main" className="px-4 py-12 sm:px-10">
        {children}
      </main>
    </div>
  );
}
