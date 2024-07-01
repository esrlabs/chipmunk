// package: sde
// file: sde.proto

import * as jspb from "google-protobuf";

export class SdeRequest extends jspb.Message {
  hasWriteText(): boolean;
  clearWriteText(): void;
  getWriteText(): string;
  setWriteText(value: string): void;

  hasWriteBytes(): boolean;
  clearWriteBytes(): void;
  getWriteBytes(): Uint8Array | string;
  getWriteBytes_asU8(): Uint8Array;
  getWriteBytes_asB64(): string;
  setWriteBytes(value: Uint8Array | string): void;

  getRequestCase(): SdeRequest.RequestCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SdeRequest.AsObject;
  static toObject(includeInstance: boolean, msg: SdeRequest): SdeRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SdeRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SdeRequest;
  static deserializeBinaryFromReader(message: SdeRequest, reader: jspb.BinaryReader): SdeRequest;
}

export namespace SdeRequest {
  export type AsObject = {
    writeText: string,
    writeBytes: Uint8Array | string,
  }

  export enum RequestCase {
    REQUEST_NOT_SET = 0,
    WRITE_TEXT = 1,
    WRITE_BYTES = 2,
  }
}

export class SdeResponse extends jspb.Message {
  getBytes(): number;
  setBytes(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SdeResponse.AsObject;
  static toObject(includeInstance: boolean, msg: SdeResponse): SdeResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SdeResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SdeResponse;
  static deserializeBinaryFromReader(message: SdeResponse, reader: jspb.BinaryReader): SdeResponse;
}

export namespace SdeResponse {
  export type AsObject = {
    bytes: number,
  }
}

