// package: attachment
// file: attachment.proto

import * as jspb from "google-protobuf";

export class AttachmentInfo extends jspb.Message {
  getUuid(): string;
  setUuid(value: string): void;

  getFilepath(): string;
  setFilepath(value: string): void;

  getName(): string;
  setName(value: string): void;

  getExt(): string;
  setExt(value: string): void;

  getSize(): number;
  setSize(value: number): void;

  getMime(): string;
  setMime(value: string): void;

  clearMessagesList(): void;
  getMessagesList(): Array<number>;
  setMessagesList(value: Array<number>): void;
  addMessages(value: number, index?: number): number;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): AttachmentInfo.AsObject;
  static toObject(includeInstance: boolean, msg: AttachmentInfo): AttachmentInfo.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: AttachmentInfo, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): AttachmentInfo;
  static deserializeBinaryFromReader(message: AttachmentInfo, reader: jspb.BinaryReader): AttachmentInfo;
}

export namespace AttachmentInfo {
  export type AsObject = {
    uuid: string,
    filepath: string,
    name: string,
    ext: string,
    size: number,
    mime: string,
    messagesList: Array<number>,
  }
}

