import "server-only";
import { Redis } from "@upstash/redis";

/** True when Upstash credentials are present (Vercel Marketplace sets UPSTASH_* or the older KV_* names). */
export const hasRedisEnv = Boolean(
  (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
  (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN),
);

if (hasRedisEnv && !process.env.UPSTASH_REDIS_REST_URL) {
  // Redis.fromEnv() reads UPSTASH_*; map the legacy Vercel KV names onto them.
  process.env.UPSTASH_REDIS_REST_URL = process.env.KV_REST_API_URL;
  process.env.UPSTASH_REDIS_REST_TOKEN = process.env.KV_REST_API_TOKEN;
}

/** The Upstash client, or null in local dev without credentials (lib/kv.ts then falls back to ./.data/kv.json). */
export const redis: Redis | null = hasRedisEnv ? Redis.fromEnv() : null;
