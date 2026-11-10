// Seed data for the first city. The seed only inserts rows that are missing, so admin
// edits survive re-running it.

export const FORMATS = [
  { code: "2d", name: "2D", bmsLabels: ["2D"], sortOrder: 10 },
  { code: "3d", name: "3D", bmsLabels: ["3D"], sortOrder: 20 },
  { code: "dolby-3d", name: "Dolby 3D", bmsLabels: ["DOLBY 3D"], sortOrder: 30 },
  { code: "epiq", name: "EPIQ", bmsLabels: ["EPIQ", "EPIQ 2D", "EPIQ 3D"], sortOrder: 40 },
  { code: "pcx", name: "PCX", bmsLabels: ["PCX", "PCX 2D", "PCX 3D"], sortOrder: 50 },
  { code: "hdr-barco", name: "HDR by Barco", bmsLabels: ["HDR BY BARCO", "BARCO HDR"], sortOrder: 60 },
];

export const CITY = { name: "Hyderabad", slug: "hyderabad", bmsRegionCode: "HYD", bmsRegionSlug: "hyderabad" };

export const AREAS = [
  "Ameerpet",
  "Attapur",
  "Banjara Hills",
  "Dilsukhnagar",
  "Gachibowli",
  "Jubilee Hills",
  "Khairatabad",
  "Kompally",
  "Kondapur",
  "Kukatpally",
  "LB Nagar",
  "Madhapur",
  "Miyapur",
  "RTC X Roads",
  "Secunderabad",
];

/**
 * Real venues, but bmsVenueCode is left empty and formats are only 2D/3D:
 * look both up on BookMyShow and fix them in the admin before relying on them.
 */
export const THEATRES: { name: string; area: string; formats: string[] }[] = [
  { name: "Prasads Multiplex", area: "Khairatabad", formats: ["2d", "3d"] },
  { name: "AMB Cinemas", area: "Gachibowli", formats: ["2d", "3d"] },
  { name: "PVR ICON Inorbit Mall", area: "Madhapur", formats: ["2d", "3d"] },
  { name: "PVR Nexus Mall", area: "Kukatpally", formats: ["2d", "3d"] },
  { name: "INOX GVK One", area: "Banjara Hills", formats: ["2d", "3d"] },
  { name: "PVR RK Cineplex", area: "Banjara Hills", formats: ["2d", "3d"] },
  { name: "AAA Cinemas", area: "Ameerpet", formats: ["2d", "3d"] },
  { name: "Sudarshan 35mm", area: "RTC X Roads", formats: ["2d"] },
  { name: "Sandhya 70mm", area: "RTC X Roads", formats: ["2d"] },
];

/**
 * Fictional films with fake event codes (ET9…), used by the mock source and for demos.
 * Skip with SEED_SAMPLE_MOVIES=false.
 */
export const SAMPLE_MOVIES = [
  {
    title: "Sample: Monsoon Signal",
    language: "Telugu",
    certificate: "UA",
    runtimeMin: 152,
    status: "now_showing" as const,
    synopsis: "Fictional sample film for local testing.",
    events: [
      { eventCode: "ET90000001", bmsSlug: "sample-monsoon-signal", language: "Telugu" },
      { eventCode: "ET90000002", bmsSlug: "sample-monsoon-signal", language: "Hindi" },
    ],
  },
  {
    title: "Sample: Orbit Nine",
    language: "English",
    certificate: "UA",
    runtimeMin: 141,
    status: "upcoming" as const,
    synopsis: "Fictional sample film for local testing.",
    events: [
      { eventCode: "ET90000003", bmsSlug: "sample-orbit-nine", language: "English", formatHint: "3D" },
    ],
  },
  {
    title: "Sample: Charminar Nights",
    language: "Telugu",
    certificate: "A",
    runtimeMin: 128,
    status: "upcoming" as const,
    synopsis: "Fictional sample film for local testing.",
    events: [{ eventCode: "ET90000004", bmsSlug: "sample-charminar-nights", language: "Telugu" }],
  },
];
