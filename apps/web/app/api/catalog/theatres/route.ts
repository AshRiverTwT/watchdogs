import type { NextRequest } from "next/server";
import { listTheatres } from "@watchdogs/db";
import { getDb } from "@/lib/server/db";
import { badRequest, json, uuidParam } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** ?city=<uuid>&area=<uuid>&format=<uuid>&q=<text> */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const cityId = uuidParam(p, "city");
  const areaId = uuidParam(p, "area");
  const formatId = uuidParam(p, "format");
  if (cityId === null || areaId === null || formatId === null) return badRequest("city, area and format must be ids");
  const q = p.get("q")?.trim().slice(0, 80) || undefined;

  const rows = await listTheatres(await getDb(), { cityId, areaId, formatId, q });
  return json({
    theatres: rows.map((t) => ({ id: t.id, name: t.name, slug: t.slug, area: t.area, formatIds: t.formatIds })),
  });
}
