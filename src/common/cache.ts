import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

import {
  CacheCase,
  PrismaExtensionRedis,
  type AutoCacheConfig,
  type CacheConfig,
} from 'prisma-extension-redis';
import { env } from './env';


const prismacli = new PrismaClient();

const client = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

const FIVE_MINUTES_IN_SECONDS = 300;
const ONE_MINUTE_IN_SECONDS = 60;

const auto: AutoCacheConfig = {
  excludedModels: [], // Models excluded from auto-caching
  excludedOperations: ['count'], // Operations excluded from auto-caching
  ttl: FIVE_MINUTES_IN_SECONDS, // Default TTL for cache in seconds
};

const config: CacheConfig = {
  ttl: FIVE_MINUTES_IN_SECONDS, // Default Time-to-live for caching in seconds
  stale: 30, // Default Stale time after ttl in seconds
  auto, // Auto-caching options (configured above)
  transformer: {
    // Custom serialize and deserialize function for additional functionality if required
    deserialize: data => JSON.parse(data),
    serialize: data => JSON.stringify(data),
  },
  type: 'JSON', // Redis cache type, whether you prefer the data to be stored as JSON or STRING in Redis
  cacheKey: { // Inbuilt cache key configuration
    case: CacheCase.SNAKE_CASE, // Select a cache case conversion option for generated keys from CacheCase
    delimiter: '*', // Delimiter for keys (default value: ':')
    prefix: 'awesomeness', // Cache key prefix (default value: 'prisma')
  },
};

const prisma = prismacli.$extends(PrismaExtensionRedis({ config, client }))

/*
MODEL ESPECIFICO CASO QUERIA ADICIONAR = {
model: 'User', // Model-specific auto-cache settings
excludedOperations: ['count'], // Operations to exclude
ttl: FIVE_MINUTES_IN_SECONDS,  // Time-to-live (TTL) for cache in seconds
stale: 5, // Stale time in seconds
}
*/
