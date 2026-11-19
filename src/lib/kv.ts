import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Redis } from "@upstash/redis";
import { hasRedisEnv, redis as client } from "./redis";

/**
 * The tiny key-value surface the app needs. Upstash Redis in production (Vercel Marketplace),
 * a JSON file at ./.data/kv.json in local dev when no Redis env vars are set.
 */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  sadd(key: string, ...members: string[]): Promise<void>;
  srem(key: string, ...members: string[]): Promise<void>;
  smembers(key: string): Promise<string[]>;
  hset(key: string, values: Record<string, unknown>): Promise<void>;
  hgetall<T>(key: string): Promise<Record<string, T>>;
  hdel(key: string, ...fields: string[]): Promise<void>;
  /** Many HGETALLs in one round trip (an Upstash pipeline). */
  hgetallMany<T>(keys: string[]): Promise<Record<string, T>[]>;
}

function upstash(redis: Redis): KV {
  return {
    get: key => redis.get(key),
    mget: async <T,>(keys: string[]) => (keys.length ? await redis.mget<(T | null)[]>(...keys) : []),
    set: async (key, value) => { await redis.set(key, value); },
    del: async key => { await redis.del(key); },
    sadd: async (key, ...members) => { if (members.length) await redis.sadd(key, members[0], ...members.slice(1)); },
    srem: async (key, ...members) => { if (members.length) await redis.srem(key, ...members); },
    smembers: key => redis.smembers(key),
    hset: async (key, values) => { await redis.hset(key, values); },
    hgetall: async <T,>(key: string) => ((await redis.hgetall<Record<string, T>>(key)) ?? {}),
    hdel: async (key, ...fields) => { if (fields.length) await redis.hdel(key, ...fields); },
    hgetallMany: async <T,>(keys: string[]) => {
      if (!keys.length) return [];
      const pipe = redis.pipeline();
      keys.forEach(key => pipe.hgetall(key));
      return ((await pipe.exec()) as (Record<string, T> | null)[]).map(value => value ?? {});
    },
  };
}

type Store = { strings: Record<string, unknown>; sets: Record<string, string[]>; hashes: Record<string, Record<string, unknown>> };
const FILE = path.join(process.cwd(), ".data", "kv.json");

function localFile(): KV {
  let chain: Promise<unknown> = Promise.resolve();
  async function load(): Promise<Store> {
    try { return JSON.parse(await fs.readFile(FILE, "utf8")) as Store; }
    catch { return { strings: {}, sets: {}, hashes: {} }; }
  }
  async function save(store: Store) {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store, null, 1));
    await fs.rename(tmp, FILE);
  }
  /** Serialises writes inside this process so read-modify-write never interleaves. */
  function write(change: (store: Store) => void) {
    const next = chain.then(async () => { const store = await load(); change(store); await save(store); });
    chain = next.catch(() => undefined);
    return next;
  }
  const clone = <T,>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
  return {
    get: async <T,>(key: string) => (clone((await load()).strings[key]) as T) ?? null,
    mget: async <T,>(keys: string[]) => { const store = await load(); return keys.map(key => (clone(store.strings[key]) as T) ?? null); },
    set: (key, value) => write(store => { store.strings[key] = value; }),
    del: key => write(store => { delete store.strings[key]; delete store.sets[key]; delete store.hashes[key]; }),
    sadd: (key, ...members) => write(store => { store.sets[key] = Array.from(new Set([...(store.sets[key] ?? []), ...members])); }),
    srem: (key, ...members) => write(store => { store.sets[key] = (store.sets[key] ?? []).filter(member => !members.includes(member)); }),
    smembers: async key => (await load()).sets[key] ?? [],
    hset: (key, values) => write(store => { store.hashes[key] = { ...(store.hashes[key] ?? {}), ...values }; }),
    hgetall: async <T,>(key: string) => clone((await load()).hashes[key] ?? {}) as Record<string, T>,
    hdel: (key, ...fields) => write(store => { const hash = store.hashes[key] ?? {}; fields.forEach(field => delete hash[field]); }),
    hgetallMany: async <T,>(keys: string[]) => { const store = await load(); return keys.map(key => clone(store.hashes[key] ?? {}) as Record<string, T>); },
  };
}

export const usingRedis = hasRedisEnv;
export const kv: KV = client ? upstash(client) : localFile();
