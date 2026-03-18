/**
 * Cloudflare R2 integration via S3-compatible API
 * Used for storing and serving media photos
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// ═══ Config ═══
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'gia-pha-photos';
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_URL || '';

// ═══ S3 Client (singleton) ═══
let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
    if (!_s3Client) {
        if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
            throw new Error('Missing R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
        }
        _s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: R2_ACCESS_KEY_ID,
                secretAccessKey: R2_SECRET_ACCESS_KEY,
            },
        });
    }
    return _s3Client;
}

// ═══ Public API ═══

/** Check if R2 is properly configured */
export function isR2Configured(): boolean {
    return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}

/** Generate a unique R2 object key for a photo */
export function generateR2Key(albumId: string | null, fileName: string): string {
    const uuid = crypto.randomUUID();
    const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const folder = albumId || 'unsorted';
    return `photos/${folder}/${uuid}.${ext}`;
}

/** Upload a file to R2 */
export async function uploadToR2(
    key: string,
    body: Buffer | Uint8Array,
    contentType: string,
): Promise<void> {
    const client = getS3Client();
    await client.send(
        new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: body,
            ContentType: contentType,
        }),
    );
}

/** Delete a file from R2 */
export async function deleteFromR2(key: string): Promise<void> {
    const client = getS3Client();
    await client.send(
        new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
        }),
    );
}

/** Get the public URL for an R2 object */
export function getR2PublicUrl(key: string): string {
    return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Get a Cloudflare Image Transform URL for on-the-fly resizing
 * Requires Image Resizing enabled on the Cloudflare zone
 */
export function getR2TransformUrl(
    key: string,
    opts: { width?: number; quality?: number; fit?: string } = {},
): string {
    const { width = 400, quality = 80, fit = 'cover' } = opts;
    return `${R2_PUBLIC_URL}/cdn-cgi/image/width=${width},quality=${quality},fit=${fit},format=auto/${key}`;
}

/** Download a file from R2 as a stream (for proxy serving) */
export async function getFromR2(key: string): Promise<{ body: ReadableStream | null; contentType: string }> {
    const client = getS3Client();
    const resp = await client.send(
        new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
        }),
    );
    return {
        body: resp.Body?.transformToWebStream() as ReadableStream | null ?? null,
        contentType: resp.ContentType || 'application/octet-stream',
    };
}
