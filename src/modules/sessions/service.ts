import { randomBytes, Sign } from "node:crypto"
import { prisma } from "../../common/prisma";
import { Auth } from "../../config/auth";
import { dragonfly, FIVE_MINUTES_IN_SECONDS } from "../../common/dragonfly";
import { genSnow } from "../../common/snow";
import { env } from "../../common/env";

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
        expiresAt: new Date(),
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

    const { refresh, hash } = Auth.genRefreshToken();
    const access = Auth.genAccessToken(user);

    await prisma.session.create({
      data: {
        id: genSnow(),
        os,
        browser,
        expiresAt: new Date(),
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

  public static async refresh(token?: string) {
    if (!token) throw new Error("Missing token")
    //verificar se o token é válido
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
