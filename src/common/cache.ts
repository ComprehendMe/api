import { PrismaClient } from '@prisma/client';

import {
  CacheCase,
  PrismaExtensionRedis,
  type AutoCacheConfig,
  type CacheConfig,
} from 'prisma-extension-redis';


export class PrismaCached {
  constructor(host: string, port: number) {
    PrismaCached.init(host, port)
  }

  private static async init(host: string, port: number) {
    const prismacli = new PrismaClient();

    const client = {
      host,
      port,
    };

    const FIVE_MINUTES_IN_SECONDS = 300;

    const auto: AutoCacheConfig = {
      excludedModels: [], // Models excluded from auto-caching
      excludedOperations: ['count'], // Operations excluded from auto-caching
      ttl: FIVE_MINUTES_IN_SECONDS, // Default TTL for cache in seconds
    };

    const config: CacheConfig = {
      ttl: FIVE_MINUTES_IN_SECONDS, // Default Time-to-live for caching in seconds
      stale: 10, // Default Stale time after ttl in seconds
      auto, // Auto-caching options (configured above)
      transformer: {
        // Custom serialize and deserialize function for additional functionality if required
        deserialize: data => JSON.parse(data),
        serialize: data => JSON.stringify(data),
      },
      type: 'JSON', // Redis cache type, whether you prefer the data to be stored as JSON or STRING in Redis
      cacheKey: { // Inbuilt cache key configuration
        case: CacheCase.SNAKE_CASE, // Select a cache case conversion option for generated keys from CacheCase
        delimiter: ':', // Delimiter for keys (default value: ':')
        prefix: 'cogniAI', // Cache key prefix (default value: 'prisma')
      },
    };

    return prismacli.$extends(PrismaExtensionRedis({ config, client }))
  }
}

/*
MODEL ESPECIFICO CASO QUERIA ADICIONAR = {
model: 'User', // Model-specific auto-cache settings
excludedOperations: ['count'], // Operations to exclude
ttl: FIVE_MINUTES_IN_SECONDS,  // Time-to-live (TTL) for cache in seconds
stale: 5, // Stale time in seconds
}
*/
