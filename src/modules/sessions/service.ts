import { randomBytes } from "node:crypto"
import { prisma } from "../../common/prisma";
import { Auth, FIFTEEN_DAYS_IN_MS } from "../../config/auth";
import { dragonfly, FIVE_MINUTES_IN_SECONDS } from "../../common/dragonfly";
import { genSnow } from "../../common/snow";
import { env } from "../../common/env";
import { httpMessages } from "../../common/request/messages";

type Provider = "google";

type LoginOptions = {
  email: string;
  password: string;
  ip: string;
  os: string;
  browser: string;
}

type UserPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

type SignupOptions = UserPayload & {
  code: string;
  ip: string;
  os: string;
  browser: string;
}

export const MAX_SESSIONS_PER_USER = 5;

export class SessionService {
  public static genCode() {
    return randomBytes(3).toString('hex').toUpperCase();
  };

  public static async resendCode(email: string) {
    const REDIS_KEY = `sessions:${email}`;
    if (await dragonfly.get<SignupOptions>(REDIS_KEY))
      throw new Error("Code already sent. Please check your email.");

    const code = this.genCode();

    await dragonfly.setex(REDIS_KEY, FIVE_MINUTES_IN_SECONDS, code);
  }

  public static async signup({ email, browser, firstName, ip, lastName, os, password, code }: SignupOptions) {
    const REDIS_KEY = `codes:${email}`;

    const storedCode = await dragonfly.get(REDIS_KEY);
    if (!storedCode || storedCode !== code) throw new Error("Invalid or expired code");

    await dragonfly.del(REDIS_KEY);

    const user = await prisma.user.create({
      data: {
        id: genSnow(),
        email,
        firstName,
        lastName,
        password: await Bun.password.hash(password),
      },
      select: { id: true, email: true }
    });

    if (!user)
      throw new Error("Error to create user");

    const { refresh, hash } = Auth.genRefreshToken();
    const access = Auth.genAccessToken(user);

    await prisma.session.create({
      data: {
        id: genSnow(),
        os,
        browser,
        expiresAt: new Date(Date.now() + FIFTEEN_DAYS_IN_MS),
        hash,
        ip,
        userId: user.id,
      }
    })

    return { access, refresh };
  }

  public static async login({
    browser,
    email,
    ip,
    os,
    password
  }: LoginOptions) {
    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
      }
    });
    if (!user)
      throw new Error("Invalid email or password");

    const isValid = await Bun.password.verify(password, user.password!);
    if (!isValid)
      throw new Error("Invalid password");

    const sessionCount = await prisma.session.count({ where: { userId: user.id } });

    if (sessionCount >= MAX_SESSIONS_PER_USER) {
      const oldestSession = await prisma.session.findFirst({
        where: { userId: user.id },
        orderBy: { id: 'asc' }
      });
      if (oldestSession) {
        await prisma.session.delete({ where: { id: oldestSession.id } });
      }
    }

    const { refresh, hash } = Auth.genRefreshToken();
    const access = Auth.genAccessToken(user);

    await prisma.session.create({
      data: {
        id: genSnow(),
        os,
        browser,
        expiresAt: new Date(Date.now() + FIFTEEN_DAYS_IN_MS),
        hash,
        ip,
        userId: user.id,
      }
    });

    return { access, refresh };
  }

  public static async authWithProvider(provider: Provider) {
    const {
      AUTH0_CALLBACK_URL,
      AUTH0_CLIENT_ID,
      AUTH0_DOMAIN,
      AUTH0_AUDIENCE
    } = env;
    const params = new URLSearchParams();

    params.append('response_type', 'code');
    params.append('client_id', AUTH0_CLIENT_ID);
    params.append('redirect_uri', AUTH0_CALLBACK_URL);
    params.append('scope', 'openid profile email');
    params.append('audience', AUTH0_AUDIENCE);

    //WARN: Change later to support more providers
    if (provider === 'google') params.append('connection', 'google-oauth2');

    return `https://${AUTH0_DOMAIN}/authorize?${params.toString()}`;
  }

  public static async handleAuth0Callback({
    code,
    ip,
    os,
    browser,
  }: {
    code: string;
    ip: string;
    os: string;
    browser: string;
  }) {
    const { AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_CALLBACK_URL } = env;

    const tokenResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: AUTH0_CLIENT_ID,
        client_secret: AUTH0_CLIENT_SECRET,
        code: code,
        redirect_uri: AUTH0_CALLBACK_URL,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange authorization code for tokens');
    }

    const { access_token } = await tokenResponse.json();

    const userinfoResponse = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userinfoResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userinfo = await userinfoResponse.json();
    const {
      email,
      sub: googleId,
      given_name: firstName,
      family_name: lastName,
      avatar
    } = userinfo;

    const user = await prisma.user.upsert({
      where: { email },
      create: { id: genSnow(), email, firstName, lastName, avatar, googleId },
      update: { googleId, firstName, lastName, avatar },
      select: { id: true, email: true },
    });

    if (!user)
      throw new Error(httpMessages.DATABASE_ERROR);

    const { refresh, hash } = Auth.genRefreshToken();
    const access = Auth.genAccessToken(user);

    await prisma.session.create({
      data: {
        id: genSnow(),
        os,
        browser,
        expiresAt: new Date(Date.now() + FIFTEEN_DAYS_IN_MS),
        hash,
        ip,
        userId: user.id,
      },
    });

    return { access, refresh };
  }

  public static async refresh(token?: string) {
    if (!token) throw new Error("Missing token")
    const hashed = Auth.hashRefreshToken(token);

    const session = await prisma.session.findFirst({
      where: {
        hash: hashed
      },
    });

    if (!session) throw new Error('Invalid refresh token');

    const user = await prisma.user.findFirst({
      where: {
        id: session.userId
      },
      select: {
        id: true,
        email: true,
      }
    });

    if (!user) throw new Error("Unknown User");

    const { hash, refresh } = Auth.genRefreshToken();
    const access = Auth.genAccessToken(user)

    await prisma.session.update({
      data: {
        hash,
      },
      where: {
        id: session.id
      }
    });

    return { refresh, access };
  }

  public static async list(userId: bigint, limit?: number) {
    let where: any = { where: { userId } }

    if (limit) where = {
      where: {
        userId
      },
      take: limit
    }

    try {
      return await prisma.session.findMany({
        where: {
          userId
        }
      });
    } catch (error) {
      console.log(error)
      throw error;
    }
  }

  public static async delete(userId: bigint, sessionId?: bigint) {
    let where: any = {
      userId,
      expiresAt: {
        lte: new Date()
      }
    }
    if (sessionId) where = {
      userId,
      expiresAt: {
        lte: new Date()
      },
      id: sessionId
    }

    try {
      await prisma.session.deleteMany({
        where,
      });
      return { ok: true }
    } catch (error) {
      console.log(error);
      return { ok: false }
    }
  }

  public static async logout(token: string) {
    const hash = Auth.hashRefreshToken(token);

    const session = await prisma.session.findFirst({
      where: {
        hash,
      },
    });

    if (!session) throw new Error("Invalid refresh token");

    await prisma.session.delete({
      where: {
        id: session.id,
      },
    });
  }
}
