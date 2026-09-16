import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { env, isS3Enabled } from './env.js';
import { logger } from './logger.js';

let client: S3Client | null = null;

function createClient(): S3Client {
  return new S3Client({
    region: env.AWS_REGION,
    // Omitting `credentials` lets the SDK use its default provider chain — an IAM role on
    // EC2/ECS/Lambda, ~/.aws/credentials, or SSO. Only pass explicit keys when given.
    ...(env.AWS_ACCESS_KEY_ID &&
      env.AWS_SECRET_ACCESS_KEY && {
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          ...(env.AWS_SESSION_TOKEN && { sessionToken: env.AWS_SESSION_TOKEN }),
        },
      }),
    // R2 / MinIO / Spaces / Backblaze.
    ...(env.AWS_S3_ENDPOINT && { endpoint: env.AWS_S3_ENDPOINT }),
    ...(env.AWS_S3_FORCE_PATH_STYLE && { forcePathStyle: true }),
    followRegionRedirects: true,
    // SDK v3 defaults to 'WHEN_SUPPORTED', which bakes a CRC32 checksum into every request —
    // including presigned PUT URLs. At sign time the body is unknown, so it signs the checksum
    // of an empty body; the browser then uploads a real body, S3 sees a mismatch and returns
    // 403. 'WHEN_REQUIRED' skips the automatic checksum so presigned PUTs accept any body.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

/** The configured bucket. Throws when S3 was never configured. */
export function getBucket(): string {
  if (!env.AWS_S3_BUCKET) {
    throw new Error('S3 is not configured. Set AWS_S3_BUCKET (and a region/credentials).');
  }
  return env.AWS_S3_BUCKET;
}

/**
 * Builds the client and confirms the bucket is reachable. No-ops (returning `null`) when
 * AWS_S3_BUCKET is unset.
 *
 * Unlike Mongo and Postgres, a failed check here *warns* rather than exiting. Two reasons:
 * the API can still serve every non-upload route without S3, and a perfectly valid
 * object-level IAM policy (GetObject/PutObject only, no s3:ListBucket) returns 403 from
 * HeadBucket even though uploads and downloads work fine.
 */
export async function connectS3(): Promise<S3Client | null> {
  if (!isS3Enabled) {
    logger.debug('S3 not configured — skipping (set AWS_S3_BUCKET to enable)');
    return null;
  }
  if (client) return client;

  client = createClient();
  const target = {
    bucket: env.AWS_S3_BUCKET,
    region: env.AWS_REGION,
    endpoint: env.AWS_S3_ENDPOINT,
  };

  try {
    await client.send(new HeadBucketCommand({ Bucket: getBucket() }));
    logger.info(target, 'S3 connected');
  } catch (err) {
    logger.warn(
      { err, ...target },
      'S3 bucket check failed — uploads may not work. This is expected if your IAM policy grants object-level access only.',
    );
  }

  return client;
}

export function disconnectS3(): void {
  if (!client) return;
  client.destroy();
  client = null;
  logger.info('S3 client closed');
}

/**
 * The S3 client, e.g. `getS3().send(new GetObjectCommand({ ... }))`.
 * Prefer the helpers in `utils/storage.ts` for everyday uploads and downloads.
 */
export function getS3(): S3Client {
  if (!client) {
    throw new Error(
      'S3 is not connected. Set AWS_S3_BUCKET (plus credentials) and call connectS3() during startup.',
    );
  }
  return client;
}

export function isS3Connected(): boolean {
  return client !== null;
}
