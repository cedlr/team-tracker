/** Round-trip check: writes, reads and deletes a key, then reads a seeded record. */
import { kv, usingRedis } from "@/lib/kv";

async function main() {
  const key = `healthcheck:${Date.now()}`;
  const value = { ok: true, at: new Date().toISOString() };
  const started = Date.now();
  await kv.set(key, value);
  const back = await kv.get<typeof value>(key);
  await kv.del(key);
  const gone = await kv.get(key);
  const team = await kv.get<{ name: string }>("team:web");
  const ok = back?.at === value.at && gone === null;
  console.log(JSON.stringify({ backend: usingRedis ? "upstash" : "local", roundTrip: ok, ms: Date.now() - started, seededTeam: team?.name ?? null }));
  process.exit(ok ? 0 : 1);
}
main().catch(error => { console.error(error); process.exit(1); });
