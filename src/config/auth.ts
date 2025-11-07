import { createHash, randomBytes } from 'node:crypto';
import { createSigner, createVerifier } from "fast-jwt";
import { env } from "../common/env";
import { Parse } from '@sinclair/typebox/value';
import { t } from "elysia";
import useragent from 'useragent';


export type UserMetadata = {
  os: string;
  browser: string;
}

const key = env.JWT_SECRET;

const verifier = createVerifier({ key })

export type JWTPayload = { id: bigint, email: string }

const AUTH_SCHEMA = t.Object({
  id: t.Transform(t.String()).Decode(BigInt).Encode(String),
  email: t.String({ format: "email" })
})

export namespace Auth {
  export const FIFTY_MINUTES_IN_MS = 100 * 60 * 15
  export const sign = createSigner({ key, expiresIn: FIFTY_MINUTES_IN_MS, });

  export const verify = (token: string) => {
    try {
      return Parse(AUTH_SCHEMA, verifier(token))
    } catch (error) {
      console.log(error)
    }
  }

  export const genAccessToken = (payload: JWTPayload) => {
    const { id, email } = payload;

    return sign({ id: String(id), email });
  }

  export const hashRefreshToken = (token: string) => {

    return createHash("sha256").update(token).digest("hex");
  }

  export const genRefreshToken = () => {
    const token = randomBytes(40).toString("hex");

    return {
      refresh: token,
      hash: hashRefreshToken(token),
    }
  }

  export const verifyAgent = async (header?: string): Promise<UserMetadata> => {
    const agent = useragent.parse(header) ?? null;
    if (agent.os.toString() === 'Other' && agent.toString() === 'Other') throw new Error('Cannot parse user agent');

    return {
      os: agent.os.toString(),
      browser: agent.toString(),
    }
  }
}

