import { t } from "elysia";
import { hostname } from "node:os";

export const ID_SCHEMA = t.Transform(t.String()).Decode(BigInt).Encode(String);

const workerBits = 10n;
const sequenceBits = 12n;
const EPOCH = 1735771200000n;

const maxSequence = (1n << sequenceBits) - 1n;

const workerId = BigInt(
  (hostname()
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0) +
    process.pid) &
  0x3ff, // 10 bits
);

let lastTimestamp = 0n;
let sequence = 0n;

export const genSnow = () => {
  const date = new Date();
  let timestamp = BigInt(date.getTime());

  if (timestamp === lastTimestamp) {
    sequence = (sequence + 1n) & maxSequence;

    if (sequence === 0n) timestamp = lastTimestamp + 1n;
  } else sequence = 0n;

  lastTimestamp = timestamp;

  return (
    ((timestamp - EPOCH) << (workerBits + sequenceBits)) |
    (workerId << sequenceBits) |
    sequence
  );
}

export const getSnowCreation = (snowflake: bigint) => {
  return Number((snowflake >> (workerBits + sequenceBits)) + EPOCH);
};
