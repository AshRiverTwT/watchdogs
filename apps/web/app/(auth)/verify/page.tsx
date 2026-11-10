import { VerifyForm } from "./form";

export const metadata = { title: "Confirm email · watchdogs" };

// Confirming takes a click (POST), so mail scanners that prefetch links cannot use up the token.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="font-display text-4xl font-bold uppercase">Confirm email</h1>
      {token ? (
        <VerifyForm token={token} />
      ) : (
        <p className="mt-6 text-paper/70">This page needs the link from your confirmation email.</p>
      )}
    </>
  );
}
