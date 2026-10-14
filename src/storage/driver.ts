export type StoredObject = {
  body: Buffer;
  contentType: string;
  size: number;
};

export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}
