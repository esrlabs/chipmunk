// package: observe
// file: observe.proto

import * as jspb from "google-protobuf";

export class ObserveOptions extends jspb.Message {
  hasOrigin(): boolean;
  clearOrigin(): void;
  getOrigin(): ObserveOrigin | undefined;
  setOrigin(value?: ObserveOrigin): void;

  hasParser(): boolean;
  clearParser(): void;
  getParser(): ParserType | undefined;
  setParser(value?: ParserType): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ObserveOptions.AsObject;
  static toObject(includeInstance: boolean, msg: ObserveOptions): ObserveOptions.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ObserveOptions, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ObserveOptions;
  static deserializeBinaryFromReader(message: ObserveOptions, reader: jspb.BinaryReader): ObserveOptions;
}

export namespace ObserveOptions {
  export type AsObject = {
    origin?: ObserveOrigin.AsObject,
    parser?: ParserType.AsObject,
  }
}

export class DltParserSettings extends jspb.Message {
  hasFilterConfig(): boolean;
  clearFilterConfig(): void;
  getFilterConfig(): DltFilterConfig | undefined;
  setFilterConfig(value?: DltFilterConfig): void;

  clearFibexFilePathsList(): void;
  getFibexFilePathsList(): Array<string>;
  setFibexFilePathsList(value: Array<string>): void;
  addFibexFilePaths(value: string, index?: number): string;

  getWithStorageHeader(): boolean;
  setWithStorageHeader(value: boolean): void;

  getTz(): string;
  setTz(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): DltParserSettings.AsObject;
  static toObject(includeInstance: boolean, msg: DltParserSettings): DltParserSettings.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: DltParserSettings, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): DltParserSettings;
  static deserializeBinaryFromReader(message: DltParserSettings, reader: jspb.BinaryReader): DltParserSettings;
}

export namespace DltParserSettings {
  export type AsObject = {
    filterConfig?: DltFilterConfig.AsObject,
    fibexFilePathsList: Array<string>,
    withStorageHeader: boolean,
    tz: string,
  }
}

export class DltFilterConfig extends jspb.Message {
  getMinLogLevel(): number;
  setMinLogLevel(value: number): void;

  clearAppIdsList(): void;
  getAppIdsList(): Array<string>;
  setAppIdsList(value: Array<string>): void;
  addAppIds(value: string, index?: number): string;

  clearEcuIdsList(): void;
  getEcuIdsList(): Array<string>;
  setEcuIdsList(value: Array<string>): void;
  addEcuIds(value: string, index?: number): string;

  clearContextIdsList(): void;
  getContextIdsList(): Array<string>;
  setContextIdsList(value: Array<string>): void;
  addContextIds(value: string, index?: number): string;

  getAppIdCount(): number;
  setAppIdCount(value: number): void;

  getContextIdCount(): number;
  setContextIdCount(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): DltFilterConfig.AsObject;
  static toObject(includeInstance: boolean, msg: DltFilterConfig): DltFilterConfig.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: DltFilterConfig, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): DltFilterConfig;
  static deserializeBinaryFromReader(message: DltFilterConfig, reader: jspb.BinaryReader): DltFilterConfig;
}

export namespace DltFilterConfig {
  export type AsObject = {
    minLogLevel: number,
    appIdsList: Array<string>,
    ecuIdsList: Array<string>,
    contextIdsList: Array<string>,
    appIdCount: number,
    contextIdCount: number,
  }
}

export class SomeIpParserSettings extends jspb.Message {
  clearFibexFilePathsList(): void;
  getFibexFilePathsList(): Array<string>;
  setFibexFilePathsList(value: Array<string>): void;
  addFibexFilePaths(value: string, index?: number): string;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SomeIpParserSettings.AsObject;
  static toObject(includeInstance: boolean, msg: SomeIpParserSettings): SomeIpParserSettings.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SomeIpParserSettings, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SomeIpParserSettings;
  static deserializeBinaryFromReader(message: SomeIpParserSettings, reader: jspb.BinaryReader): SomeIpParserSettings;
}

export namespace SomeIpParserSettings {
  export type AsObject = {
    fibexFilePathsList: Array<string>,
  }
}

export class ProcessTransportConfig extends jspb.Message {
  getCwd(): string;
  setCwd(value: string): void;

  getCommand(): string;
  setCommand(value: string): void;

  getEnvsMap(): jspb.Map<string, string>;
  clearEnvsMap(): void;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ProcessTransportConfig.AsObject;
  static toObject(includeInstance: boolean, msg: ProcessTransportConfig): ProcessTransportConfig.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ProcessTransportConfig, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ProcessTransportConfig;
  static deserializeBinaryFromReader(message: ProcessTransportConfig, reader: jspb.BinaryReader): ProcessTransportConfig;
}

export namespace ProcessTransportConfig {
  export type AsObject = {
    cwd: string,
    command: string,
    envsMap: Array<[string, string]>,
  }
}

export class SerialTransportConfig extends jspb.Message {
  getPath(): string;
  setPath(value: string): void;

  getBaudRate(): number;
  setBaudRate(value: number): void;

  getDataBits(): number;
  setDataBits(value: number): void;

  getFlowControl(): number;
  setFlowControl(value: number): void;

  getParity(): number;
  setParity(value: number): void;

  getStopBits(): number;
  setStopBits(value: number): void;

  getSendDataDelay(): number;
  setSendDataDelay(value: number): void;

  getExclusive(): boolean;
  setExclusive(value: boolean): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SerialTransportConfig.AsObject;
  static toObject(includeInstance: boolean, msg: SerialTransportConfig): SerialTransportConfig.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SerialTransportConfig, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SerialTransportConfig;
  static deserializeBinaryFromReader(message: SerialTransportConfig, reader: jspb.BinaryReader): SerialTransportConfig;
}

export namespace SerialTransportConfig {
  export type AsObject = {
    path: string,
    baudRate: number,
    dataBits: number,
    flowControl: number,
    parity: number,
    stopBits: number,
    sendDataDelay: number,
    exclusive: boolean,
  }
}

export class TCPTransportConfig extends jspb.Message {
  getBindAddr(): string;
  setBindAddr(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TCPTransportConfig.AsObject;
  static toObject(includeInstance: boolean, msg: TCPTransportConfig): TCPTransportConfig.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: TCPTransportConfig, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TCPTransportConfig;
  static deserializeBinaryFromReader(message: TCPTransportConfig, reader: jspb.BinaryReader): TCPTransportConfig;
}

export namespace TCPTransportConfig {
  export type AsObject = {
    bindAddr: string,
  }
}

export class MulticastInfo extends jspb.Message {
  getMultiaddr(): string;
  setMultiaddr(value: string): void;

  getInterface(): string;
  setInterface(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MulticastInfo.AsObject;
  static toObject(includeInstance: boolean, msg: MulticastInfo): MulticastInfo.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: MulticastInfo, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MulticastInfo;
  static deserializeBinaryFromReader(message: MulticastInfo, reader: jspb.BinaryReader): MulticastInfo;
}

export namespace MulticastInfo {
  export type AsObject = {
    multiaddr: string,
    pb_interface: string,
  }
}

export class UDPTransportConfig extends jspb.Message {
  getBindAddr(): string;
  setBindAddr(value: string): void;

  clearMulticastList(): void;
  getMulticastList(): Array<MulticastInfo>;
  setMulticastList(value: Array<MulticastInfo>): void;
  addMulticast(value?: MulticastInfo, index?: number): MulticastInfo;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): UDPTransportConfig.AsObject;
  static toObject(includeInstance: boolean, msg: UDPTransportConfig): UDPTransportConfig.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: UDPTransportConfig, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): UDPTransportConfig;
  static deserializeBinaryFromReader(message: UDPTransportConfig, reader: jspb.BinaryReader): UDPTransportConfig;
}

export namespace UDPTransportConfig {
  export type AsObject = {
    bindAddr: string,
    multicastList: Array<MulticastInfo.AsObject>,
  }
}

export class FileFormat extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): FileFormat.AsObject;
  static toObject(includeInstance: boolean, msg: FileFormat): FileFormat.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: FileFormat, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): FileFormat;
  static deserializeBinaryFromReader(message: FileFormat, reader: jspb.BinaryReader): FileFormat;
}

export namespace FileFormat {
  export type AsObject = {
  }

  export interface TypeMap {
    PCAPNG: 0;
    PCAPLEGACY: 1;
    TEXT: 2;
    BINARY: 3;
  }

  export const Type: TypeMap;
}

export class ParserType extends jspb.Message {
  hasDlt(): boolean;
  clearDlt(): void;
  getDlt(): DltParserSettings | undefined;
  setDlt(value?: DltParserSettings): void;

  hasSomeIp(): boolean;
  clearSomeIp(): void;
  getSomeIp(): SomeIpParserSettings | undefined;
  setSomeIp(value?: SomeIpParserSettings): void;

  hasText(): boolean;
  clearText(): void;
  getText(): boolean;
  setText(value: boolean): void;

  getTypeCase(): ParserType.TypeCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ParserType.AsObject;
  static toObject(includeInstance: boolean, msg: ParserType): ParserType.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ParserType, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ParserType;
  static deserializeBinaryFromReader(message: ParserType, reader: jspb.BinaryReader): ParserType;
}

export namespace ParserType {
  export type AsObject = {
    dlt?: DltParserSettings.AsObject,
    someIp?: SomeIpParserSettings.AsObject,
    text: boolean,
  }

  export enum TypeCase {
    TYPE_NOT_SET = 0,
    DLT = 1,
    SOME_IP = 2,
    TEXT = 3,
  }
}

export class Transport extends jspb.Message {
  hasProcess(): boolean;
  clearProcess(): void;
  getProcess(): ProcessTransportConfig | undefined;
  setProcess(value?: ProcessTransportConfig): void;

  hasTcp(): boolean;
  clearTcp(): void;
  getTcp(): TCPTransportConfig | undefined;
  setTcp(value?: TCPTransportConfig): void;

  hasUdp(): boolean;
  clearUdp(): void;
  getUdp(): UDPTransportConfig | undefined;
  setUdp(value?: UDPTransportConfig): void;

  hasSerial(): boolean;
  clearSerial(): void;
  getSerial(): SerialTransportConfig | undefined;
  setSerial(value?: SerialTransportConfig): void;

  getTransportCase(): Transport.TransportCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Transport.AsObject;
  static toObject(includeInstance: boolean, msg: Transport): Transport.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Transport, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Transport;
  static deserializeBinaryFromReader(message: Transport, reader: jspb.BinaryReader): Transport;
}

export namespace Transport {
  export type AsObject = {
    process?: ProcessTransportConfig.AsObject,
    tcp?: TCPTransportConfig.AsObject,
    udp?: UDPTransportConfig.AsObject,
    serial?: SerialTransportConfig.AsObject,
  }

  export enum TransportCase {
    TRANSPORT_NOT_SET = 0,
    PROCESS = 1,
    TCP = 2,
    UDP = 3,
    SERIAL = 4,
  }
}

export class ObserveOrigin extends jspb.Message {
  hasFile(): boolean;
  clearFile(): void;
  getFile(): ObserveOrigin.File | undefined;
  setFile(value?: ObserveOrigin.File): void;

  hasConcat(): boolean;
  clearConcat(): void;
  getConcat(): ObserveOrigin.Concat | undefined;
  setConcat(value?: ObserveOrigin.Concat): void;

  hasStream(): boolean;
  clearStream(): void;
  getStream(): ObserveOrigin.Stream | undefined;
  setStream(value?: ObserveOrigin.Stream): void;

  getOriginCase(): ObserveOrigin.OriginCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ObserveOrigin.AsObject;
  static toObject(includeInstance: boolean, msg: ObserveOrigin): ObserveOrigin.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ObserveOrigin, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ObserveOrigin;
  static deserializeBinaryFromReader(message: ObserveOrigin, reader: jspb.BinaryReader): ObserveOrigin;
}

export namespace ObserveOrigin {
  export type AsObject = {
    file?: ObserveOrigin.File.AsObject,
    concat?: ObserveOrigin.Concat.AsObject,
    stream?: ObserveOrigin.Stream.AsObject,
  }

  export class File extends jspb.Message {
    getName(): string;
    setName(value: string): void;

    getFormat(): FileFormat.TypeMap[keyof FileFormat.TypeMap];
    setFormat(value: FileFormat.TypeMap[keyof FileFormat.TypeMap]): void;

    getPath(): string;
    setPath(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): File.AsObject;
    static toObject(includeInstance: boolean, msg: File): File.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: File, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): File;
    static deserializeBinaryFromReader(message: File, reader: jspb.BinaryReader): File;
  }

  export namespace File {
    export type AsObject = {
      name: string,
      format: FileFormat.TypeMap[keyof FileFormat.TypeMap],
      path: string,
    }
  }

  export class Concat extends jspb.Message {
    clearFilesList(): void;
    getFilesList(): Array<ObserveOrigin.File>;
    setFilesList(value: Array<ObserveOrigin.File>): void;
    addFiles(value?: ObserveOrigin.File, index?: number): ObserveOrigin.File;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Concat.AsObject;
    static toObject(includeInstance: boolean, msg: Concat): Concat.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Concat, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Concat;
    static deserializeBinaryFromReader(message: Concat, reader: jspb.BinaryReader): Concat;
  }

  export namespace Concat {
    export type AsObject = {
      filesList: Array<ObserveOrigin.File.AsObject>,
    }
  }

  export class Stream extends jspb.Message {
    getName(): string;
    setName(value: string): void;

    hasTransport(): boolean;
    clearTransport(): void;
    getTransport(): Transport | undefined;
    setTransport(value?: Transport): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Stream.AsObject;
    static toObject(includeInstance: boolean, msg: Stream): Stream.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Stream, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Stream;
    static deserializeBinaryFromReader(message: Stream, reader: jspb.BinaryReader): Stream;
  }

  export namespace Stream {
    export type AsObject = {
      name: string,
      transport?: Transport.AsObject,
    }
  }

  export enum OriginCase {
    ORIGIN_NOT_SET = 0,
    FILE = 1,
    CONCAT = 2,
    STREAM = 3,
  }
}

