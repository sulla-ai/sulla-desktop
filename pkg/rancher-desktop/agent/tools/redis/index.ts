// Import all redis tool registrations
import { redisDecrRegistration } from './redis_decr';
import { redisDelRegistration } from './redis_del';
import { redisExpireRegistration } from './redis_expire';
import { redisGetRegistration } from './redis_get';
import { redisHgetRegistration } from './redis_hget';
import { redisHgetallRegistration } from './redis_hgetall';
import { redisHsetRegistration } from './redis_hset';
import { redisIncrRegistration } from './redis_incr';
import { redisLpopRegistration } from './redis_lpop';
import { redisRpushRegistration } from './redis_rpush';
import { redisSetRegistration } from './redis_set';
import { redisTtlRegistration } from './redis_ttl';

// Export all redis tool registrations as an array
export const redisToolRegistrations = [
  redisDecrRegistration,
  redisDelRegistration,
  redisExpireRegistration,
  redisGetRegistration,
  redisHgetRegistration,
  redisHgetallRegistration,
  redisHsetRegistration,
  redisIncrRegistration,
  redisLpopRegistration,
  redisRpushRegistration,
  redisSetRegistration,
  redisTtlRegistration,
];
