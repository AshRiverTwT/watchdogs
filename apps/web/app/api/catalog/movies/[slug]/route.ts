import { getMovieBySlug } from "@watchdogs/db";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { publicMovie } from "../shape";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const movie = await getMovieBySlug(await getDb(), slug.slice(0, 120));
  if (!movie) return Response.json({ error: "not found" }, { status: 404 });
  return json({ movie: publicMovie(movie) });
}
