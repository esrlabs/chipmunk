// package: common
// file: common.proto

import * as jspb from "google-protobuf";

export class Range extends jspb.Message {
  getStart(): number;
  setStart(value: number): void;

  getEnd(): number;
  setEnd(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Range.AsObject;
  static toObject(includeInstance: boolean, msg: Range): Range.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Range, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Range;
  static deserializeBinaryFromReader(message: Range, reader: jspb.BinaryReader): Range;
}

export namespace Range {
  export type AsObject = {
    start: number,
    end: number,
  }
}

export class RangeInclusive extends jspb.Message {
  getStart(): number;
  setStart(value: number): void;

  getEnd(): number;
  setEnd(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): RangeInclusive.AsObject;
  static toObject(includeInstance: boolean, msg: RangeInclusive): RangeInclusive.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: RangeInclusive, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): RangeInclusive;
  static deserializeBinaryFromReader(message: RangeInclusive, reader: jspb.BinaryReader): RangeInclusive;
}

export namespace RangeInclusive {
  export type AsObject = {
    start: number,
    end: number,
  }
}

