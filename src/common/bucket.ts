import { env } from "./env";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";

const { BUCKET_ACCESS_KEY, BUCKET_ENDPOINT, BUCKET_NAME, BUCKET_SECRET_KEY } = env;

const s3 = new S3Client({
  region: 'auto',
  endpoint: BUCKET_ENDPOINT,
  credentials: {
    accessKeyId: BUCKET_ACCESS_KEY,
    secretAccessKey: BUCKET_SECRET_KEY,
  },
});

export class Bucket {
  public static async genPresignedUrl(key: string, expires = 300) {
    const hash = randomBytes(8).toString("hex");

    const route = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
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
      Bucket: BUCKET_NAME,
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
