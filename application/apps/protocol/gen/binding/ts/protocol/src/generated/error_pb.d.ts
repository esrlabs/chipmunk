// package: error
// file: error.proto

import * as jspb from "google-protobuf";
import * as common_pb from "./common_pb";

export class GrabError extends jspb.Message {
  hasConfig(): boolean;
  clearConfig(): void;
  getConfig(): GrabError.Config | undefined;
  setConfig(value?: GrabError.Config): void;

  hasCommunication(): boolean;
  clearCommunication(): void;
  getCommunication(): GrabError.Communication | undefined;
  setCommunication(value?: GrabError.Communication): void;

  hasIoOperation(): boolean;
  clearIoOperation(): void;
  getIoOperation(): GrabError.IoOperation | undefined;
  setIoOperation(value?: GrabError.IoOperation): void;

  hasInvalidRange(): boolean;
  clearInvalidRange(): void;
  getInvalidRange(): GrabError.InvalidRange | undefined;
  setInvalidRange(value?: GrabError.InvalidRange): void;

  hasInterrupted(): boolean;
  clearInterrupted(): void;
  getInterrupted(): GrabError.Interrupted | undefined;
  setInterrupted(value?: GrabError.Interrupted): void;

  hasNotInitialize(): boolean;
  clearNotInitialize(): void;
  getNotInitialize(): GrabError.NotInitialize | undefined;
  setNotInitialize(value?: GrabError.NotInitialize): void;

  hasUnsupported(): boolean;
  clearUnsupported(): void;
  getUnsupported(): GrabError.Unsupported | undefined;
  setUnsupported(value?: GrabError.Unsupported): void;

  getErrorCase(): GrabError.ErrorCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GrabError.AsObject;
  static toObject(includeInstance: boolean, msg: GrabError): GrabError.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: GrabError, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GrabError;
  static deserializeBinaryFromReader(message: GrabError, reader: jspb.BinaryReader): GrabError;
}

export namespace GrabError {
  export type AsObject = {
    config?: GrabError.Config.AsObject,
    communication?: GrabError.Communication.AsObject,
    ioOperation?: GrabError.IoOperation.AsObject,
    invalidRange?: GrabError.InvalidRange.AsObject,
    interrupted?: GrabError.Interrupted.AsObject,
    notInitialize?: GrabError.NotInitialize.AsObject,
    unsupported?: GrabError.Unsupported.AsObject,
  }

  export class Config extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Config.AsObject;
    static toObject(includeInstance: boolean, msg: Config): Config.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Config, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Config;
    static deserializeBinaryFromReader(message: Config, reader: jspb.BinaryReader): Config;
  }

  export namespace Config {
    export type AsObject = {
      message: string,
    }
  }

  export class Communication extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Communication.AsObject;
    static toObject(includeInstance: boolean, msg: Communication): Communication.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Communication, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Communication;
    static deserializeBinaryFromReader(message: Communication, reader: jspb.BinaryReader): Communication;
  }

  export namespace Communication {
    export type AsObject = {
      message: string,
    }
  }

  export class IoOperation extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): IoOperation.AsObject;
    static toObject(includeInstance: boolean, msg: IoOperation): IoOperation.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: IoOperation, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): IoOperation;
    static deserializeBinaryFromReader(message: IoOperation, reader: jspb.BinaryReader): IoOperation;
  }

  export namespace IoOperation {
    export type AsObject = {
      message: string,
    }
  }

  export class InvalidRange extends jspb.Message {
    hasRange(): boolean;
    clearRange(): void;
    getRange(): common_pb.RangeInclusive | undefined;
    setRange(value?: common_pb.RangeInclusive): void;

    getContext(): string;
    setContext(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): InvalidRange.AsObject;
    static toObject(includeInstance: boolean, msg: InvalidRange): InvalidRange.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: InvalidRange, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): InvalidRange;
    static deserializeBinaryFromReader(message: InvalidRange, reader: jspb.BinaryReader): InvalidRange;
  }

  export namespace InvalidRange {
    export type AsObject = {
      range?: common_pb.RangeInclusive.AsObject,
      context: string,
    }
  }

  export class Interrupted extends jspb.Message {
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Interrupted.AsObject;
    static toObject(includeInstance: boolean, msg: Interrupted): Interrupted.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Interrupted, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Interrupted;
    static deserializeBinaryFromReader(message: Interrupted, reader: jspb.BinaryReader): Interrupted;
  }

  export namespace Interrupted {
    export type AsObject = {
    }
  }

  export class NotInitialize extends jspb.Message {
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): NotInitialize.AsObject;
    static toObject(includeInstance: boolean, msg: NotInitialize): NotInitialize.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: NotInitialize, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): NotInitialize;
    static deserializeBinaryFromReader(message: NotInitialize, reader: jspb.BinaryReader): NotInitialize;
  }

  export namespace NotInitialize {
    export type AsObject = {
    }
  }

  export class Unsupported extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Unsupported.AsObject;
    static toObject(includeInstance: boolean, msg: Unsupported): Unsupported.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Unsupported, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Unsupported;
    static deserializeBinaryFromReader(message: Unsupported, reader: jspb.BinaryReader): Unsupported;
  }

  export namespace Unsupported {
    export type AsObject = {
      message: string,
    }
  }

  export enum ErrorCase {
    ERROR_NOT_SET = 0,
    CONFIG = 1,
    COMMUNICATION = 2,
    IO_OPERATION = 3,
    INVALID_RANGE = 4,
    INTERRUPTED = 5,
    NOT_INITIALIZE = 6,
    UNSUPPORTED = 7,
  }
}

export class SearchError extends jspb.Message {
  hasConfig(): boolean;
  clearConfig(): void;
  getConfig(): SearchError.Config | undefined;
  setConfig(value?: SearchError.Config): void;

  hasCommunication(): boolean;
  clearCommunication(): void;
  getCommunication(): SearchError.Communication | undefined;
  setCommunication(value?: SearchError.Communication): void;

  hasIoOperation(): boolean;
  clearIoOperation(): void;
  getIoOperation(): SearchError.IoOperation | undefined;
  setIoOperation(value?: SearchError.IoOperation): void;

  hasRegex(): boolean;
  clearRegex(): void;
  getRegex(): SearchError.Regex | undefined;
  setRegex(value?: SearchError.Regex): void;

  hasInput(): boolean;
  clearInput(): void;
  getInput(): SearchError.Input | undefined;
  setInput(value?: SearchError.Input): void;

  hasGrab(): boolean;
  clearGrab(): void;
  getGrab(): SearchError.Grab | undefined;
  setGrab(value?: SearchError.Grab): void;

  hasAborted(): boolean;
  clearAborted(): void;
  getAborted(): SearchError.Aborted | undefined;
  setAborted(value?: SearchError.Aborted): void;

  getErrorCase(): SearchError.ErrorCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SearchError.AsObject;
  static toObject(includeInstance: boolean, msg: SearchError): SearchError.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SearchError, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SearchError;
  static deserializeBinaryFromReader(message: SearchError, reader: jspb.BinaryReader): SearchError;
}

export namespace SearchError {
  export type AsObject = {
    config?: SearchError.Config.AsObject,
    communication?: SearchError.Communication.AsObject,
    ioOperation?: SearchError.IoOperation.AsObject,
    regex?: SearchError.Regex.AsObject,
    input?: SearchError.Input.AsObject,
    grab?: SearchError.Grab.AsObject,
    aborted?: SearchError.Aborted.AsObject,
  }

  export class Config extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Config.AsObject;
    static toObject(includeInstance: boolean, msg: Config): Config.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Config, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Config;
    static deserializeBinaryFromReader(message: Config, reader: jspb.BinaryReader): Config;
  }

  export namespace Config {
    export type AsObject = {
      message: string,
    }
  }

  export class Communication extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Communication.AsObject;
    static toObject(includeInstance: boolean, msg: Communication): Communication.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Communication, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Communication;
    static deserializeBinaryFromReader(message: Communication, reader: jspb.BinaryReader): Communication;
  }

  export namespace Communication {
    export type AsObject = {
      message: string,
    }
  }

  export class IoOperation extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): IoOperation.AsObject;
    static toObject(includeInstance: boolean, msg: IoOperation): IoOperation.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: IoOperation, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): IoOperation;
    static deserializeBinaryFromReader(message: IoOperation, reader: jspb.BinaryReader): IoOperation;
  }

  export namespace IoOperation {
    export type AsObject = {
      message: string,
    }
  }

  export class Regex extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Regex.AsObject;
    static toObject(includeInstance: boolean, msg: Regex): Regex.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Regex, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Regex;
    static deserializeBinaryFromReader(message: Regex, reader: jspb.BinaryReader): Regex;
  }

  export namespace Regex {
    export type AsObject = {
      message: string,
    }
  }

  export class Input extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Input.AsObject;
    static toObject(includeInstance: boolean, msg: Input): Input.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Input, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Input;
    static deserializeBinaryFromReader(message: Input, reader: jspb.BinaryReader): Input;
  }

  export namespace Input {
    export type AsObject = {
      message: string,
    }
  }

  export class Grab extends jspb.Message {
    hasError(): boolean;
    clearError(): void;
    getError(): GrabError | undefined;
    setError(value?: GrabError): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Grab.AsObject;
    static toObject(includeInstance: boolean, msg: Grab): Grab.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Grab, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Grab;
    static deserializeBinaryFromReader(message: Grab, reader: jspb.BinaryReader): Grab;
  }

  export namespace Grab {
    export type AsObject = {
      error?: GrabError.AsObject,
    }
  }

  export class Aborted extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Aborted.AsObject;
    static toObject(includeInstance: boolean, msg: Aborted): Aborted.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Aborted, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Aborted;
    static deserializeBinaryFromReader(message: Aborted, reader: jspb.BinaryReader): Aborted;
  }

  export namespace Aborted {
    export type AsObject = {
      message: string,
    }
  }

  export enum ErrorCase {
    ERROR_NOT_SET = 0,
    CONFIG = 1,
    COMMUNICATION = 2,
    IO_OPERATION = 3,
    REGEX = 4,
    INPUT = 5,
    GRAB = 6,
    ABORTED = 7,
  }
}

export class NativeError extends jspb.Message {
  getSeverity(): SeverityMap[keyof SeverityMap];
  setSeverity(value: SeverityMap[keyof SeverityMap]): void;

  getKind(): NativeErrorKindMap[keyof NativeErrorKindMap];
  setKind(value: NativeErrorKindMap[keyof NativeErrorKindMap]): void;

  getMessage(): string;
  setMessage(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): NativeError.AsObject;
  static toObject(includeInstance: boolean, msg: NativeError): NativeError.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: NativeError, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): NativeError;
  static deserializeBinaryFromReader(message: NativeError, reader: jspb.BinaryReader): NativeError;
}

export namespace NativeError {
  export type AsObject = {
    severity: SeverityMap[keyof SeverityMap],
    kind: NativeErrorKindMap[keyof NativeErrorKindMap],
    message: string,
  }
}

export class ComputationError extends jspb.Message {
  hasDestinationPath(): boolean;
  clearDestinationPath(): void;
  getDestinationPath(): ComputationError.DestinationPath | undefined;
  setDestinationPath(value?: ComputationError.DestinationPath): void;

  hasSessionCreatingFail(): boolean;
  clearSessionCreatingFail(): void;
  getSessionCreatingFail(): ComputationError.SessionCreatingFail | undefined;
  setSessionCreatingFail(value?: ComputationError.SessionCreatingFail): void;

  hasCommunication(): boolean;
  clearCommunication(): void;
  getCommunication(): ComputationError.Communication | undefined;
  setCommunication(value?: ComputationError.Communication): void;

  hasOperationNotSupported(): boolean;
  clearOperationNotSupported(): void;
  getOperationNotSupported(): ComputationError.OperationNotSupported | undefined;
  setOperationNotSupported(value?: ComputationError.OperationNotSupported): void;

  hasIoOperation(): boolean;
  clearIoOperation(): void;
  getIoOperation(): ComputationError.IoOperation | undefined;
  setIoOperation(value?: ComputationError.IoOperation): void;

  hasInvalidData(): boolean;
  clearInvalidData(): void;
  getInvalidData(): ComputationError.InvalidData | undefined;
  setInvalidData(value?: ComputationError.InvalidData): void;

  hasInvalidArgs(): boolean;
  clearInvalidArgs(): void;
  getInvalidArgs(): ComputationError.InvalidArgs | undefined;
  setInvalidArgs(value?: ComputationError.InvalidArgs): void;

  hasProcess(): boolean;
  clearProcess(): void;
  getProcess(): ComputationError.Process | undefined;
  setProcess(value?: ComputationError.Process): void;

  hasProtocol(): boolean;
  clearProtocol(): void;
  getProtocol(): ComputationError.Protocol | undefined;
  setProtocol(value?: ComputationError.Protocol): void;

  hasSearchError(): boolean;
  clearSearchError(): void;
  getSearchError(): SearchError | undefined;
  setSearchError(value?: SearchError): void;

  hasMultipleInitCall(): boolean;
  clearMultipleInitCall(): void;
  getMultipleInitCall(): ComputationError.MultipleInitCall | undefined;
  setMultipleInitCall(value?: ComputationError.MultipleInitCall): void;

  hasSessionUnavailable(): boolean;
  clearSessionUnavailable(): void;
  getSessionUnavailable(): ComputationError.SessionUnavailable | undefined;
  setSessionUnavailable(value?: ComputationError.SessionUnavailable): void;

  hasNativeError(): boolean;
  clearNativeError(): void;
  getNativeError(): NativeError | undefined;
  setNativeError(value?: NativeError): void;

  hasGrabbing(): boolean;
  clearGrabbing(): void;
  getGrabbing(): ComputationError.Grabbing | undefined;
  setGrabbing(value?: ComputationError.Grabbing): void;

  hasSde(): boolean;
  clearSde(): void;
  getSde(): ComputationError.Sde | undefined;
  setSde(value?: ComputationError.Sde): void;

  getErrorCase(): ComputationError.ErrorCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ComputationError.AsObject;
  static toObject(includeInstance: boolean, msg: ComputationError): ComputationError.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ComputationError, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ComputationError;
  static deserializeBinaryFromReader(message: ComputationError, reader: jspb.BinaryReader): ComputationError;
}

export namespace ComputationError {
  export type AsObject = {
    destinationPath?: ComputationError.DestinationPath.AsObject,
    sessionCreatingFail?: ComputationError.SessionCreatingFail.AsObject,
    communication?: ComputationError.Communication.AsObject,
    operationNotSupported?: ComputationError.OperationNotSupported.AsObject,
    ioOperation?: ComputationError.IoOperation.AsObject,
    invalidData?: ComputationError.InvalidData.AsObject,
    invalidArgs?: ComputationError.InvalidArgs.AsObject,
    process?: ComputationError.Process.AsObject,
    protocol?: ComputationError.Protocol.AsObject,
    searchError?: SearchError.AsObject,
    multipleInitCall?: ComputationError.MultipleInitCall.AsObject,
    sessionUnavailable?: ComputationError.SessionUnavailable.AsObject,
    nativeError?: NativeError.AsObject,
    grabbing?: ComputationError.Grabbing.AsObject,
    sde?: ComputationError.Sde.AsObject,
  }

  export class DestinationPath extends jspb.Message {
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DestinationPath.AsObject;
    static toObject(includeInstance: boolean, msg: DestinationPath): DestinationPath.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DestinationPath, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DestinationPath;
    static deserializeBinaryFromReader(message: DestinationPath, reader: jspb.BinaryReader): DestinationPath;
  }

  export namespace DestinationPath {
    export type AsObject = {
    }
  }

  export class SessionCreatingFail extends jspb.Message {
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SessionCreatingFail.AsObject;
    static toObject(includeInstance: boolean, msg: SessionCreatingFail): SessionCreatingFail.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SessionCreatingFail, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SessionCreatingFail;
    static deserializeBinaryFromReader(message: SessionCreatingFail, reader: jspb.BinaryReader): SessionCreatingFail;
  }

  export namespace SessionCreatingFail {
    export type AsObject = {
    }
  }

  export class Communication extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Communication.AsObject;
    static toObject(includeInstance: boolean, msg: Communication): Communication.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Communication, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Communication;
    static deserializeBinaryFromReader(message: Communication, reader: jspb.BinaryReader): Communication;
  }

  export namespace Communication {
    export type AsObject = {
      message: string,
    }
  }

  export class OperationNotSupported extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): OperationNotSupported.AsObject;
    static toObject(includeInstance: boolean, msg: OperationNotSupported): OperationNotSupported.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: OperationNotSupported, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): OperationNotSupported;
    static deserializeBinaryFromReader(message: OperationNotSupported, reader: jspb.BinaryReader): OperationNotSupported;
  }

  export namespace OperationNotSupported {
    export type AsObject = {
      message: string,
    }
  }

  export class IoOperation extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): IoOperation.AsObject;
    static toObject(includeInstance: boolean, msg: IoOperation): IoOperation.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: IoOperation, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): IoOperation;
    static deserializeBinaryFromReader(message: IoOperation, reader: jspb.BinaryReader): IoOperation;
  }

  export namespace IoOperation {
    export type AsObject = {
      message: string,
    }
  }

  export class InvalidData extends jspb.Message {
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): InvalidData.AsObject;
    static toObject(includeInstance: boolean, msg: InvalidData): InvalidData.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: InvalidData, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): InvalidData;
    static deserializeBinaryFromReader(message: InvalidData, reader: jspb.BinaryReader): InvalidData;
  }

  export namespace InvalidData {
    export type AsObject = {
    }
  }

  export class InvalidArgs extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): InvalidArgs.AsObject;
    static toObject(includeInstance: boolean, msg: InvalidArgs): InvalidArgs.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: InvalidArgs, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): InvalidArgs;
    static deserializeBinaryFromReader(message: InvalidArgs, reader: jspb.BinaryReader): InvalidArgs;
  }

  export namespace InvalidArgs {
    export type AsObject = {
      message: string,
    }
  }

  export class Process extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Process.AsObject;
    static toObject(includeInstance: boolean, msg: Process): Process.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Process, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Process;
    static deserializeBinaryFromReader(message: Process, reader: jspb.BinaryReader): Process;
  }

  export namespace Process {
    export type AsObject = {
      message: string,
    }
  }

  export class Protocol extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Protocol.AsObject;
    static toObject(includeInstance: boolean, msg: Protocol): Protocol.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Protocol, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Protocol;
    static deserializeBinaryFromReader(message: Protocol, reader: jspb.BinaryReader): Protocol;
  }

  export namespace Protocol {
    export type AsObject = {
      message: string,
    }
  }

  export class MultipleInitCall extends jspb.Message {
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): MultipleInitCall.AsObject;
    static toObject(includeInstance: boolean, msg: MultipleInitCall): MultipleInitCall.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: MultipleInitCall, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): MultipleInitCall;
    static deserializeBinaryFromReader(message: MultipleInitCall, reader: jspb.BinaryReader): MultipleInitCall;
  }

  export namespace MultipleInitCall {
    export type AsObject = {
    }
  }

  export class SessionUnavailable extends jspb.Message {
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SessionUnavailable.AsObject;
    static toObject(includeInstance: boolean, msg: SessionUnavailable): SessionUnavailable.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SessionUnavailable, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SessionUnavailable;
    static deserializeBinaryFromReader(message: SessionUnavailable, reader: jspb.BinaryReader): SessionUnavailable;
  }

  export namespace SessionUnavailable {
    export type AsObject = {
    }
  }

  export class Grabbing extends jspb.Message {
    hasError(): boolean;
    clearError(): void;
    getError(): GrabError | undefined;
    setError(value?: GrabError): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Grabbing.AsObject;
    static toObject(includeInstance: boolean, msg: Grabbing): Grabbing.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Grabbing, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Grabbing;
    static deserializeBinaryFromReader(message: Grabbing, reader: jspb.BinaryReader): Grabbing;
  }

  export namespace Grabbing {
    export type AsObject = {
      error?: GrabError.AsObject,
    }
  }

  export class Sde extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Sde.AsObject;
    static toObject(includeInstance: boolean, msg: Sde): Sde.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Sde, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Sde;
    static deserializeBinaryFromReader(message: Sde, reader: jspb.BinaryReader): Sde;
  }

  export namespace Sde {
    export type AsObject = {
      message: string,
    }
  }

  export enum ErrorCase {
    ERROR_NOT_SET = 0,
    DESTINATION_PATH = 1,
    SESSION_CREATING_FAIL = 2,
    COMMUNICATION = 3,
    OPERATION_NOT_SUPPORTED = 4,
    IO_OPERATION = 5,
    INVALID_DATA = 6,
    INVALID_ARGS = 7,
    PROCESS = 8,
    PROTOCOL = 9,
    SEARCH_ERROR = 10,
    MULTIPLE_INIT_CALL = 11,
    SESSION_UNAVAILABLE = 12,
    NATIVE_ERROR = 13,
    GRABBING = 14,
    SDE = 15,
  }
}

export interface NativeErrorKindMap {
  FILENOTFOUND: 0;
  UNSUPPORTEDFILETYPE: 1;
  COMPUTATIONFAILED: 2;
  CONFIGURATION: 3;
  INTERRUPTED: 4;
  OPERATIONSEARCH: 5;
  NOTYETIMPLEMENTED: 6;
  CHANNELERROR: 7;
  IO: 8;
  GRABBER: 9;
}

export const NativeErrorKind: NativeErrorKindMap;

export interface SeverityMap {
  WARNING: 0;
  ERROR: 1;
}

export const Severity: SeverityMap;

