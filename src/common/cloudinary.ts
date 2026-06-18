import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

cloudinary.config({
	cloud_name: env.CLOUDINARY_CLOUD_NAME,
	api_key: env.CLOUDINARY_API_KEY,
	api_secret: env.CLOUDINARY_API_SECRET,
});

export class Cloudinary {
	static uploadImage(buffer: Buffer): Promise<{ url: string; publicId: string }> {
		return new Promise((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{ folder: 'avatars', format: 'webp', resource_type: 'image' },
				(error, result) => {
					if (error) reject(error);
					else resolve({ url: result!.secure_url, publicId: result!.public_id });
				},
			);
			uploadStream.end(buffer);
		});
	}

	static async deleteImage(publicId: string): Promise<void> {
		await cloudinary.uploader.destroy(publicId);
	}
}
