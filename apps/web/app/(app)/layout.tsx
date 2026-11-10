import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/server/auth";
import { VerifyBanner } from "./verify-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      {!user.emailVerifiedAt && <VerifyBanner email={user.email} />}
      <main id="main" className="px-4 py-12 sm:px-10">
        {children}
      </main>
    </div>
  );
}
