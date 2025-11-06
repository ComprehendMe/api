import { env } from "./env";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";

const { R2_ACCESS_KEY, R2_BUCKET, R2_SECRET_KEY, R2_ENDPOINT } = env;

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
});

export class Bucket {
  public static async genPresignedUrl(key: string, expires = 300) {
    const hash = randomBytes(8).toString("hex");

    const route = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: `${key}/${hash}.webp`,
        ContentType: 'image/webp',
      }),
      { expiresIn: expires });

    return {
      hash,
      route,
    };
  }

  public static async remove(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: `${key}.webp`,
    });

    try {
      await s3.send(command);

      return { ok: true };
    } catch (error) {
      console.error("Error removing object from bucket:", error);
      return { ok: false };
    }
  }
}
