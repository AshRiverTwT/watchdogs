import type { MovieWithEvents } from "@watchdogs/db";

export function publicMovie(m: MovieWithEvents) {
  return {
    id: m.id,
    title: m.title,
    slug: m.slug,
    synopsis: m.synopsis,
    language: m.language,
    certificate: m.certificate,
    runtimeMin: m.runtimeMin,
    releaseDate: m.releaseDate,
    posterUrl: m.posterPath ? `/uploads/posters/${m.posterPath}` : null,
    status: m.status,
    variants: m.events.map((e) => ({ id: e.id, language: e.language, formatHint: e.formatHint })),
  };
}
