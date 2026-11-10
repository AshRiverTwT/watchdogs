import { createDb } from "../index";
import { seedCatalog } from "./catalog";

const db = await createDb();
const counts = await seedCatalog(db, { sampleMovies: process.env.SEED_SAMPLE_MOVIES !== "false" });
console.log("catalog seeded:", counts);
process.exit(0);
