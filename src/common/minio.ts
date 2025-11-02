import { env } from "./env";
import { randomBytes } from "node:crypto"
import * as s3 from "aws4";

const { MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_ENDPOINT, MINIO_BUCKET } = env;

const { host, protocol } = new URL(MINIO_ENDPOINT);

export class Minio {
  public static async genPresignedUrl(key: string, expires = 60) {
    const hash = randomBytes(16).toString("hex");
    const { path } = s3.sign(
      {
        host,
        method: "PUT",
        service: "s3",
        path: `/${MINIO_BUCKET}/${key}/${hash}.jpg?X-Amz-Expires=${expires}`
      }, {
      accessKeyId: MINIO_ACCESS_KEY,
      secretAccessKey: MINIO_SECRET_KEY
    });

    return {
      hash,
      route: `${protocol}//${host}${path}`
    }
  }

  public static async remove(key: string) {
    const { headers } = s3.sign({
      service: "s3",
      method: "DELETE",
      path: `/${host}/${MINIO_BUCKET}/${key}.jpg`
    }, { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY })

    const { ok } = await fetch(`${protocol}//${host}/${MINIO_BUCKET}/${key}`, {
      //@ts-expect-error
      headers,
      method: 'DELETE',
    });

    return ok;
  }
}





