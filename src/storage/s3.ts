import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { StorageDriver, StoredObject } from "./driver";
import { assertSafeStorageKey } from "./key";
import type { S3StorageConfig } from "./config";

type ObjectBody = {
  transformToByteArray(): Promise<Uint8Array>;
};

export type ObjectStorageClient = {
  send(command: unknown): Promise<{
    Body?: ObjectBody;
    ContentType?: string;
  }>;
};

export class S3Driver implements StorageDriver {
  constructor(
    private readonly client: ObjectStorageClient,
    private readonly bucket: string,
    private readonly tenantId: string,
  ) {
    if (!/^[A-Za-z0-9-]+$/.test(tenantId)) {
      throw new Error("Tenant id is invalid.");
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
      }),
    );
  }

  async get(key: string): Promise<StoredObject> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
      }),
    );
    if (!result.Body) {
      throw new Error("Stored object is missing.");
    }
    const body = Buffer.from(await result.Body.transformToByteArray());
    return {
      body,
      contentType: result.ContentType ?? "application/octet-stream",
      size: body.length,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
      }),
    );
  }

  private objectKey(key: string): string {
    return `${this.tenantId}/${assertSafeStorageKey(key)}`;
  }
}

export function createS3Client(config: S3StorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}
