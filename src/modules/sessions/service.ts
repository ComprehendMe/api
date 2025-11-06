import { } from "drizzle-orm"
import { randomBytes } from "node:crypto"
import { prisma } from "../../common/prisma";

export class SessionService {
  genCode() {
    return randomBytes(3).toString('hex').toUpperCase();
  };

  signup() {

  }

  login() {

  }

  refresh() {

  }

  deleteById(sessionId: string) {

  }

  async delete(limit?: number) {
    await prisma.session.findFirst({
      where: {
        expiresAt: {

        }
      }
    });
  }
}
