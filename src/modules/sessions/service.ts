import { randomBytes } from "node:crypto"
import { prisma } from "../../common/prisma";
import { Auth } from "../../config/auth";
import { dragonfly } from "../../common/dragonfly";
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
  ip: string;
  os: string;
  browser: string;
}

export class SessionService {
  public genCode() {
    return randomBytes(3).toString('hex').toUpperCase();
  };

  public async resendCode() {

  }

  public async signup(code: string) {
    const REDIS_KEY = `codes:${code}`;

    const data = await dragonfly.get<SignupOptions>(REDIS_KEY);
    if (!data) throw new Error("Invalid or expired code");

    const { browser, ip, os, email, firstName, lastName, password } = data;

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
  public async login({
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

  public async authWithProvider(provider: Provider) {
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

    if (provider) {
      const connection = provider === 'google' ? 'google-oauth2' : 'GitHub';
      params.append('connection', connection);
    }

    return `https://${AUTH0_DOMAIN}/authorize?${params.toString()}`;
  }

  async refresh(token?: string) {
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

  async list(userId: bigint, limit?: number) {
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

  async delete(userId: bigint, sessionId?: bigint) {
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
      await prisma.session.findMany({
        where,
      });
      return { ok: true }
    } catch (error) {
      console.log(error);
      return { ok: false }
    }
  }
}
