// package: grabbing
// file: grabbing.proto

import * as jspb from "google-protobuf";

export class GrabbedElement extends jspb.Message {
  getSourceId(): number;
  setSourceId(value: number): void;

  getContent(): string;
  setContent(value: string): void;

  getPos(): number;
  setPos(value: number): void;

  getNature(): number;
  setNature(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GrabbedElement.AsObject;
  static toObject(includeInstance: boolean, msg: GrabbedElement): GrabbedElement.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: GrabbedElement, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GrabbedElement;
  static deserializeBinaryFromReader(message: GrabbedElement, reader: jspb.BinaryReader): GrabbedElement;
}

export namespace GrabbedElement {
  export type AsObject = {
    sourceId: number,
    content: string,
    pos: number,
    nature: number,
  }
}

export class GrabbedElementList extends jspb.Message {
  clearElementsList(): void;
  getElementsList(): Array<GrabbedElement>;
  setElementsList(value: Array<GrabbedElement>): void;
  addElements(value?: GrabbedElement, index?: number): GrabbedElement;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GrabbedElementList.AsObject;
  static toObject(includeInstance: boolean, msg: GrabbedElementList): GrabbedElementList.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: GrabbedElementList, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GrabbedElementList;
  static deserializeBinaryFromReader(message: GrabbedElementList, reader: jspb.BinaryReader): GrabbedElementList;
}

export namespace GrabbedElementList {
  export type AsObject = {
    elementsList: Array<GrabbedElement.AsObject>,
  }
}

