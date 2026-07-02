import { randomUUID } from 'node:crypto';
import type { Sink } from '@reporters/mux';
import { remoteSink } from './remote.ts';

const DEFAULT_VIEWER = 'https://molow.github.io/reporters/';
const WEEK_SECONDS = 604800;

export interface Sdk {
  S3Client: new (config: Record<string, unknown>) => { send(command: unknown): Promise<unknown> };
  PutObjectCommand: new (input: Record<string, unknown>) => unknown;
  GetObjectCommand: new (input: Record<string, unknown>) => unknown;
  getSignedUrl: (client: unknown, command: unknown, options: { expiresIn: number }) => Promise<string>;
}

async function loadSdk(): Promise<Sdk> {
  try {
    const [client, presigner] = await Promise.all([
      import('@aws-sdk/client-s3'),
      import('@aws-sdk/s3-request-presigner'),
    ]);
    return {
      S3Client: client.S3Client,
      PutObjectCommand: client.PutObjectCommand,
      GetObjectCommand: client.GetObjectCommand,
      getSignedUrl: presigner.getSignedUrl,
    } as unknown as Sdk;
  /* c8 ignore start -- only reachable when the optional peer isn't installed */
  } catch {
    throw new Error('@reporters/sink: install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner to use the s3 sink');
  }
  /* c8 ignore stop */
}

/** Indirection so tests inject a fake SDK without network or the real client. */
export const internals = { loadSdk };

export interface S3Options {
  bucket: string;
  /** Object key; defaults to `reporters/${GITHUB_RUN_ID ?? randomUUID()}.ndjson`. */
  key?: string;
  region?: string;
  /** S3-compatible stores (R2 / MinIO / GCS). */
  endpoint?: string;
  /** Defaults to the AWS SDK's default provider chain (env, OIDC, instance role). */
  credentials?: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
  /** Presigned GET expiry in seconds (default 7 days). */
  expiresIn?: number;
  viewerBase?: string;
  flushMs?: number;
  /** Viewer polling cadence in ms (default 1000; the viewer clamps to 100–10000). */
  pollMs?: number;
}

/**
 * Uploads the run's NDJSON to an S3(-compatible) bucket via the AWS SDK and
 * signs a presigned GET the hosted viewer reads it back through.
 */
export function s3(opts: S3Options): Sink {
  const key = opts.key ?? `reporters/${process.env.GITHUB_RUN_ID ?? randomUUID()}.ndjson`;
  let getUrl: string | undefined;
  let putObject: ((body: Buffer) => Promise<void>) | undefined;

  return remoteSink({
    flushMs: opts.flushMs,
    async start() {
      const sdk = await internals.loadSdk();
      const client = new sdk.S3Client({
        ...(opts.region ? { region: opts.region } : {}),
        ...(opts.endpoint ? { endpoint: opts.endpoint } : {}),
        ...(opts.credentials ? { credentials: opts.credentials } : {}),
      });
      putObject = async (body) => {
        await client.send(new sdk.PutObjectCommand({
          Bucket: opts.bucket, Key: key, Body: body, ContentType: 'application/x-ndjson',
        }));
      };
      getUrl = await sdk.getSignedUrl(
        client,
        new sdk.GetObjectCommand({ Bucket: opts.bucket, Key: key }),
        { expiresIn: opts.expiresIn ?? WEEK_SECONDS },
      );
    },
    async upload(body) {
      await putObject!(body);
    },
    viewerUrl() {
      if (!getUrl) return undefined;
      return `${opts.viewerBase ?? DEFAULT_VIEWER}?src=${encodeURIComponent(getUrl)}${opts.pollMs ? `&poll=${opts.pollMs}` : ''}`;
    },
  });
}
