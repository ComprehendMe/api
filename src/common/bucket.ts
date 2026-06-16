import { env } from "./env";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";

const { BUCKET_ACCESS_KEY, BUCKET_ENDPOINT, BUCKET_NAME, BUCKET_SECRET_KEY } =
  env;

/** MinIO (and most local S3 emulators) require path-style URLs. */
const usePathStyle = /localhost|127\.0\.0\.1/i.test(BUCKET_ENDPOINT);

const s3 = new S3Client({
  region: "auto",
  endpoint: BUCKET_ENDPOINT,
  forcePathStyle: usePathStyle,
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
        ContentType: "image/webp",
      }),
      { expiresIn: expires }
    );

    return {
      hash,
      route,
    };
  }

  public static async putWebp(keyPrefix: string, body: Buffer | Uint8Array) {
    const hash = randomBytes(8).toString("hex");
    const objectKey = `${keyPrefix}/${hash}.webp`;

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: objectKey,
          Body: body,
          ContentType: "image/webp",
        })
      );
    } catch (error) {
      console.error("Error uploading to bucket:", error);
      throw error;
    }

    return hash;
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
