import { ResetForm } from "./form";

export const metadata = { title: "New password · watchdogs" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="font-display text-4xl font-bold uppercase">New password</h1>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <p className="mt-6 text-paper/70">This page needs the link from your reset email.</p>
      )}
    </>
  );
}
