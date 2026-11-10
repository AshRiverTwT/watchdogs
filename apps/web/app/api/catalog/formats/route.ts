import { listFormats } from "@watchdogs/db";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await listFormats(await getDb());
  return json({ formats: rows.map(({ id, code, name }) => ({ id, code, name })) });
}
