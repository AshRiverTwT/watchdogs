/** One showtime as read from a source, before it is mapped to catalog ids. */
export interface ScrapedShow {
  eventCode: string;   // BMS ET… code
  venueCode: string;   // BMS venue code
  dateCode: string;    // YYYYMMDD
  time: string;        // HH:MM, IST
  formatLabel: string; // e.g. "2D", "IMAX 3D", as shown on the page
  bookingUrl: string;
}

export type FetchOutcome =
  | { status: "ok"; shows: ScrapedShow[]; httpStatus?: number }
  | { status: "blocked"; reason: string; httpStatus?: number }
  | { status: "error"; reason: string; httpStatus?: number };

export interface ShowQuery {
  eventCode: string;
  regionCode: string;
  dateCode: string;
}

/** Implemented by MockSource, BmsBrowserSource and IngestSource. */
export interface ShowSource {
  readonly name: string;
  fetchShows(query: ShowQuery): Promise<FetchOutcome>;
  close?(): Promise<void>;
}
