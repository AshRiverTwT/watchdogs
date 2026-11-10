import type { NextRequest } from "next/server";
import { listMovies } from "@watchdogs/db";
import { getDb } from "@/lib/server/db";
import { badRequest, json } from "@/lib/server/http";
import { publicMovie } from "./shape";

export const dynamic = "force-dynamic";

const STATUSES = ["upcoming", "now_showing"] as const;
type PublicStatus = (typeof STATUSES)[number];

/** ?status=upcoming,now_showing&q=<text>. Archived films are never listed here. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const raw = p.get("status")?.split(",").filter(Boolean) ?? [...STATUSES];
  if (!raw.every((s): s is PublicStatus => (STATUSES as readonly string[]).includes(s))) {
    return badRequest(`status must be one of ${STATUSES.join(", ")}`);
  }
  const q = p.get("q")?.trim().slice(0, 80) || undefined;
  const rows = await listMovies(await getDb(), { status: raw as PublicStatus[], q });
  return json({ movies: rows.map(publicMovie) });
}
