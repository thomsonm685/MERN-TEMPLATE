import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type _Object,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { getBucket, getS3 } from '../config/s3.js';

/** Extensions we can name a Content-Type for without pulling in a mime database. */
const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  pdf: 'application/pdf',
  json: 'application/json',
  csv: 'text/csv',
  txt: 'text/plain',
  zip: 'application/zip',
};

export function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

/** Lowercase, strip anything that isn't URL-safe, collapse runs of separators. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * A collision-proof object key: `prefix/2026-09-16T10-30-00-000Z-a1b2c3-my-file.jpg`.
 *
 * The timestamp keeps keys sorted chronologically and the random suffix means two users
 * uploading `photo.jpg` in the same millisecond never overwrite each other. Never build a
 * key from user input alone.
 */
export function buildObjectKey(filename: string, prefix = 'uploads'): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  const base = slugify(path.basename(filename, path.extname(filename))).slice(0, 60) || 'file';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = randomBytes(3).toString('hex');
  const cleanPrefix = prefix ? `${prefix.replace(/^\/+|\/+$/g, '')}/` : '';
  return `${cleanPrefix}${stamp}-${rand}-${base}${ext ? `.${ext}` : ''}`;
}

export interface UploadOptions {
  key: string;
  body: Buffer | Uint8Array | string | Readable;
  contentType?: string;
  /** Becomes S3 object metadata (`x-amz-meta-*`). Values must be strings. */
  metadata?: Record<string, string>;
  /** `inline` renders in the browser; `attachment` forces a download. */
  contentDisposition?: string;
  cacheControl?: string;
}

/**
 * Uploads any body to S3, switching to multipart automatically for large payloads.
 *
 * `Upload` from lib-storage sends a single PutObject when the body fits in one part and
 * splits into concurrent 8MB parts when it doesn't — so this is safe for a 12KB avatar and
 * a 2GB video alike, and never buffers the whole stream in memory.
 */
export async function uploadObject(options: UploadOptions): Promise<string> {
  const uploader = new Upload({
    client: getS3(),
    params: {
      Bucket: getBucket(),
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType ?? contentTypeFor(options.key),
      ...(options.metadata && { Metadata: options.metadata }),
      ...(options.contentDisposition && { ContentDisposition: options.contentDisposition }),
      ...(options.cacheControl && { CacheControl: options.cacheControl }),
      // Only sent when AWS_S3_ACL is set — modern buckets reject ACLs outright.
      ...(env.AWS_S3_ACL && { ACL: env.AWS_S3_ACL }),
    },
    // AWS requires parts of at least 5MB; 8MB keeps per-request memory small.
    partSize: 8 * 1024 * 1024,
    queueSize: 2,
  });

  await uploader.done();
  return options.key;
}

/** Streams a local file to S3 without reading it into memory. */
export async function uploadFile(
  filePath: string,
  key = buildObjectKey(path.basename(filePath)),
  contentType?: string,
): Promise<string> {
  return uploadObject({
    key,
    body: createReadStream(filePath),
    contentType: contentType ?? contentTypeFor(filePath),
  });
}

/**
 * Downloads an object into a Buffer.
 *
 * Only for things you know are small — images, JSON, thumbnails. A 500MB video read this
 * way will exhaust memory; use `downloadToFile` for those.
 */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await getS3().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
  if (!res.Body) throw new Error(`S3 object has no body: ${key}`);
  return Buffer.from(await res.Body.transformToByteArray());
}

/** Streams an object to a local path, never holding the whole body in memory. */
export async function downloadToFile(key: string, destPath: string): Promise<string> {
  const res = await getS3().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
  if (!res.Body) throw new Error(`S3 object has no body: ${key}`);
  await pipeline(res.Body as Readable, createWriteStream(destPath));
  return destPath;
}

/**
 * A time-limited URL for reading a private object. Hand this to the browser instead of
 * proxying bytes through Express.
 */
export function getDownloadUrl(
  key: string,
  expiresIn = env.AWS_S3_PRESIGN_EXPIRES,
): Promise<string> {
  return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: getBucket(), Key: key }), {
    expiresIn,
  });
}

/**
 * A time-limited URL the browser can PUT straight to, bypassing your server entirely.
 * This is the right way to accept large video uploads — the bytes never touch the API.
 *
 * The client must send the same Content-Type it was signed with, or S3 returns 403.
 */
export function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn = env.AWS_S3_PRESIGN_EXPIRES,
): Promise<string> {
  return getSignedUrl(
    getS3(),
    new PutObjectCommand({ Bucket: getBucket(), Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

/**
 * The permanent URL for a publicly-readable object — your CDN origin when AWS_S3_PUBLIC_URL
 * is set, otherwise the bucket's own endpoint. Returns a URL whether or not the object is
 * actually public; use `getDownloadUrl` for private buckets.
 */
export function getPublicUrl(key: string): string {
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  if (env.AWS_S3_PUBLIC_URL) return `${env.AWS_S3_PUBLIC_URL.replace(/\/+$/, '')}/${encoded}`;
  if (env.AWS_S3_ENDPOINT) {
    const base = env.AWS_S3_ENDPOINT.replace(/\/+$/, '');
    return env.AWS_S3_FORCE_PATH_STYLE
      ? `${base}/${getBucket()}/${encoded}`
      : `${base.replace('://', `://${getBucket()}.`)}/${encoded}`;
  }
  return `https://${getBucket()}.s3.${env.AWS_REGION}.amazonaws.com/${encoded}`;
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getS3().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return true;
  } catch (err) {
    // The SDK reports a missing key as NotFound / 404; anything else is a real failure.
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await getS3().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

/** Deletes up to 1000 keys per call — the S3 limit for a single DeleteObjects request. */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await getS3().send(
      new DeleteObjectsCommand({
        Bucket: getBucket(),
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      }),
    );
  }
}

/** Lists objects under a prefix, following pagination up to `maxKeys`. */
export async function listObjects(prefix = '', maxKeys = 1000): Promise<_Object[]> {
  const found: _Object[] = [];
  let token: string | undefined;

  do {
    const res = await getS3().send(
      new ListObjectsV2Command({
        Bucket: getBucket(),
        Prefix: prefix || undefined,
        ContinuationToken: token,
        MaxKeys: Math.min(1000, maxKeys - found.length),
      }),
    );
    found.push(...(res.Contents ?? []));
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token && found.length < maxKeys);

  return found;
}
