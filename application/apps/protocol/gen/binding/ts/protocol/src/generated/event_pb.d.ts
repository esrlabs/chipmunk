// package: event
// file: event.proto

import * as jspb from "google-protobuf";
import * as error_pb from "./error_pb";
import * as attachment_pb from "./attachment_pb";

export class OperationDone extends jspb.Message {
  getUuid(): string;
  setUuid(value: string): void;

  getResult(): string;
  setResult(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): OperationDone.AsObject;
  static toObject(includeInstance: boolean, msg: OperationDone): OperationDone.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: OperationDone, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): OperationDone;
  static deserializeBinaryFromReader(message: OperationDone, reader: jspb.BinaryReader): OperationDone;
}

export namespace OperationDone {
  export type AsObject = {
    uuid: string,
    result: string,
  }
}

export class Ticks extends jspb.Message {
  getCount(): number;
  setCount(value: number): void;

  getState(): string;
  setState(value: string): void;

  getTotal(): number;
  setTotal(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Ticks.AsObject;
  static toObject(includeInstance: boolean, msg: Ticks): Ticks.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Ticks, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Ticks;
  static deserializeBinaryFromReader(message: Ticks, reader: jspb.BinaryReader): Ticks;
}

export namespace Ticks {
  export type AsObject = {
    count: number,
    state: string,
    total: number,
  }
}

export class Notification extends jspb.Message {
  getSeverity(): error_pb.SeverityMap[keyof error_pb.SeverityMap];
  setSeverity(value: error_pb.SeverityMap[keyof error_pb.SeverityMap]): void;

  getContent(): string;
  setContent(value: string): void;

  getLine(): number;
  setLine(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Notification.AsObject;
  static toObject(includeInstance: boolean, msg: Notification): Notification.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Notification, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Notification;
  static deserializeBinaryFromReader(message: Notification, reader: jspb.BinaryReader): Notification;
}

export namespace Notification {
  export type AsObject = {
    severity: error_pb.SeverityMap[keyof error_pb.SeverityMap],
    content: string,
    line: number,
  }
}

export class CallbackEvent extends jspb.Message {
  hasStreamUpdated(): boolean;
  clearStreamUpdated(): void;
  getStreamUpdated(): number;
  setStreamUpdated(value: number): void;

  hasFileRead(): boolean;
  clearFileRead(): void;
  getFileRead(): boolean;
  setFileRead(value: boolean): void;

  hasSearchUpdated(): boolean;
  clearSearchUpdated(): void;
  getSearchUpdated(): CallbackEvent.SearchUpdated | undefined;
  setSearchUpdated(value?: CallbackEvent.SearchUpdated): void;

  hasIndexedMapUpdated(): boolean;
  clearIndexedMapUpdated(): void;
  getIndexedMapUpdated(): CallbackEvent.IndexedMapUpdated | undefined;
  setIndexedMapUpdated(value?: CallbackEvent.IndexedMapUpdated): void;

  hasSearchMapUpdated(): boolean;
  clearSearchMapUpdated(): void;
  getSearchMapUpdated(): CallbackEvent.SearchMapUpdated | undefined;
  setSearchMapUpdated(value?: CallbackEvent.SearchMapUpdated): void;

  hasSearchValuesUpdated(): boolean;
  clearSearchValuesUpdated(): void;
  getSearchValuesUpdated(): CallbackEvent.SearchValuesUpdated | undefined;
  setSearchValuesUpdated(value?: CallbackEvent.SearchValuesUpdated): void;

  hasAttachmentsUpdated(): boolean;
  clearAttachmentsUpdated(): void;
  getAttachmentsUpdated(): CallbackEvent.AttachmentsUpdated | undefined;
  setAttachmentsUpdated(value?: CallbackEvent.AttachmentsUpdated): void;

  hasProgress(): boolean;
  clearProgress(): void;
  getProgress(): CallbackEvent.Progress | undefined;
  setProgress(value?: CallbackEvent.Progress): void;

  hasSessionError(): boolean;
  clearSessionError(): void;
  getSessionError(): error_pb.NativeError | undefined;
  setSessionError(value?: error_pb.NativeError): void;

  hasOperationError(): boolean;
  clearOperationError(): void;
  getOperationError(): CallbackEvent.OperationError | undefined;
  setOperationError(value?: CallbackEvent.OperationError): void;

  hasOperationStarted(): boolean;
  clearOperationStarted(): void;
  getOperationStarted(): string;
  setOperationStarted(value: string): void;

  hasOperationProcessing(): boolean;
  clearOperationProcessing(): void;
  getOperationProcessing(): string;
  setOperationProcessing(value: string): void;

  hasOperationDone(): boolean;
  clearOperationDone(): void;
  getOperationDone(): OperationDone | undefined;
  setOperationDone(value?: OperationDone): void;

  hasSessionDestroyed(): boolean;
  clearSessionDestroyed(): void;
  getSessionDestroyed(): boolean;
  setSessionDestroyed(value: boolean): void;

  getEventCase(): CallbackEvent.EventCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): CallbackEvent.AsObject;
  static toObject(includeInstance: boolean, msg: CallbackEvent): CallbackEvent.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: CallbackEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): CallbackEvent;
  static deserializeBinaryFromReader(message: CallbackEvent, reader: jspb.BinaryReader): CallbackEvent;
}

export namespace CallbackEvent {
  export type AsObject = {
    streamUpdated: number,
    fileRead: boolean,
    searchUpdated?: CallbackEvent.SearchUpdated.AsObject,
    indexedMapUpdated?: CallbackEvent.IndexedMapUpdated.AsObject,
    searchMapUpdated?: CallbackEvent.SearchMapUpdated.AsObject,
    searchValuesUpdated?: CallbackEvent.SearchValuesUpdated.AsObject,
    attachmentsUpdated?: CallbackEvent.AttachmentsUpdated.AsObject,
    progress?: CallbackEvent.Progress.AsObject,
    sessionError?: error_pb.NativeError.AsObject,
    operationError?: CallbackEvent.OperationError.AsObject,
    operationStarted: string,
    operationProcessing: string,
    operationDone?: OperationDone.AsObject,
    sessionDestroyed: boolean,
  }

  export class SearchUpdated extends jspb.Message {
    getFound(): number;
    setFound(value: number): void;

    getStatMap(): jspb.Map<string, number>;
    clearStatMap(): void;
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SearchUpdated.AsObject;
    static toObject(includeInstance: boolean, msg: SearchUpdated): SearchUpdated.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SearchUpdated, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SearchUpdated;
    static deserializeBinaryFromReader(message: SearchUpdated, reader: jspb.BinaryReader): SearchUpdated;
  }

  export namespace SearchUpdated {
    export type AsObject = {
      found: number,
      statMap: Array<[string, number]>,
    }
  }

  export class IndexedMapUpdated extends jspb.Message {
    getLen(): number;
    setLen(value: number): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): IndexedMapUpdated.AsObject;
    static toObject(includeInstance: boolean, msg: IndexedMapUpdated): IndexedMapUpdated.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: IndexedMapUpdated, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): IndexedMapUpdated;
    static deserializeBinaryFromReader(message: IndexedMapUpdated, reader: jspb.BinaryReader): IndexedMapUpdated;
  }

  export namespace IndexedMapUpdated {
    export type AsObject = {
      len: number,
    }
  }

  export class SearchMapUpdated extends jspb.Message {
    getUpdate(): string;
    setUpdate(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SearchMapUpdated.AsObject;
    static toObject(includeInstance: boolean, msg: SearchMapUpdated): SearchMapUpdated.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SearchMapUpdated, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SearchMapUpdated;
    static deserializeBinaryFromReader(message: SearchMapUpdated, reader: jspb.BinaryReader): SearchMapUpdated;
  }

  export namespace SearchMapUpdated {
    export type AsObject = {
      update: string,
    }
  }

  export class SearchValuesUpdated extends jspb.Message {
    getValuesMap(): jspb.Map<number, CallbackEvent.SearchValuesUpdated.ValueRange>;
    clearValuesMap(): void;
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SearchValuesUpdated.AsObject;
    static toObject(includeInstance: boolean, msg: SearchValuesUpdated): SearchValuesUpdated.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SearchValuesUpdated, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SearchValuesUpdated;
    static deserializeBinaryFromReader(message: SearchValuesUpdated, reader: jspb.BinaryReader): SearchValuesUpdated;
  }

  export namespace SearchValuesUpdated {
    export type AsObject = {
      valuesMap: Array<[number, CallbackEvent.SearchValuesUpdated.ValueRange.AsObject]>,
    }

    export class ValueRange extends jspb.Message {
      getMin(): number;
      setMin(value: number): void;

      getMax(): number;
      setMax(value: number): void;

      serializeBinary(): Uint8Array;
      toObject(includeInstance?: boolean): ValueRange.AsObject;
      static toObject(includeInstance: boolean, msg: ValueRange): ValueRange.AsObject;
      static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
      static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
      static serializeBinaryToWriter(message: ValueRange, writer: jspb.BinaryWriter): void;
      static deserializeBinary(bytes: Uint8Array): ValueRange;
      static deserializeBinaryFromReader(message: ValueRange, reader: jspb.BinaryReader): ValueRange;
    }

    export namespace ValueRange {
      export type AsObject = {
        min: number,
        max: number,
      }
    }
  }

  export class AttachmentsUpdated extends jspb.Message {
    getLen(): number;
    setLen(value: number): void;

    hasAttachment(): boolean;
    clearAttachment(): void;
    getAttachment(): attachment_pb.AttachmentInfo | undefined;
    setAttachment(value?: attachment_pb.AttachmentInfo): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): AttachmentsUpdated.AsObject;
    static toObject(includeInstance: boolean, msg: AttachmentsUpdated): AttachmentsUpdated.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: AttachmentsUpdated, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): AttachmentsUpdated;
    static deserializeBinaryFromReader(message: AttachmentsUpdated, reader: jspb.BinaryReader): AttachmentsUpdated;
  }

  export namespace AttachmentsUpdated {
    export type AsObject = {
      len: number,
      attachment?: attachment_pb.AttachmentInfo.AsObject,
    }
  }

  export class Progress extends jspb.Message {
    getUuid(): string;
    setUuid(value: string): void;

    hasDetail(): boolean;
    clearDetail(): void;
    getDetail(): CallbackEvent.Progress.ProgressDetail | undefined;
    setDetail(value?: CallbackEvent.Progress.ProgressDetail): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Progress.AsObject;
    static toObject(includeInstance: boolean, msg: Progress): Progress.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Progress, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Progress;
    static deserializeBinaryFromReader(message: Progress, reader: jspb.BinaryReader): Progress;
  }

  export namespace Progress {
    export type AsObject = {
      uuid: string,
      detail?: CallbackEvent.Progress.ProgressDetail.AsObject,
    }

    export class ProgressDetail extends jspb.Message {
      hasTicks(): boolean;
      clearTicks(): void;
      getTicks(): Ticks | undefined;
      setTicks(value?: Ticks): void;

      hasNotification(): boolean;
      clearNotification(): void;
      getNotification(): Notification | undefined;
      setNotification(value?: Notification): void;

      hasStopped(): boolean;
      clearStopped(): void;
      getStopped(): boolean;
      setStopped(value: boolean): void;

      getDetailCase(): ProgressDetail.DetailCase;
      serializeBinary(): Uint8Array;
      toObject(includeInstance?: boolean): ProgressDetail.AsObject;
      static toObject(includeInstance: boolean, msg: ProgressDetail): ProgressDetail.AsObject;
      static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
      static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
      static serializeBinaryToWriter(message: ProgressDetail, writer: jspb.BinaryWriter): void;
      static deserializeBinary(bytes: Uint8Array): ProgressDetail;
      static deserializeBinaryFromReader(message: ProgressDetail, reader: jspb.BinaryReader): ProgressDetail;
    }

    export namespace ProgressDetail {
      export type AsObject = {
        ticks?: Ticks.AsObject,
        notification?: Notification.AsObject,
        stopped: boolean,
      }

      export enum DetailCase {
        DETAIL_NOT_SET = 0,
        TICKS = 1,
        NOTIFICATION = 2,
        STOPPED = 3,
      }
    }
  }

  export class OperationError extends jspb.Message {
    getUuid(): string;
    setUuid(value: string): void;

    hasError(): boolean;
    clearError(): void;
    getError(): error_pb.NativeError | undefined;
    setError(value?: error_pb.NativeError): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): OperationError.AsObject;
    static toObject(includeInstance: boolean, msg: OperationError): OperationError.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: OperationError, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): OperationError;
    static deserializeBinaryFromReader(message: OperationError, reader: jspb.BinaryReader): OperationError;
  }

  export namespace OperationError {
    export type AsObject = {
      uuid: string,
      error?: error_pb.NativeError.AsObject,
    }
  }

  export enum EventCase {
    EVENT_NOT_SET = 0,
    STREAM_UPDATED = 1,
    FILE_READ = 2,
    SEARCH_UPDATED = 3,
    INDEXED_MAP_UPDATED = 4,
    SEARCH_MAP_UPDATED = 5,
    SEARCH_VALUES_UPDATED = 6,
    ATTACHMENTS_UPDATED = 7,
    PROGRESS = 8,
    SESSION_ERROR = 9,
    OPERATION_ERROR = 10,
    OPERATION_STARTED = 11,
    OPERATION_PROCESSING = 12,
    OPERATION_DONE = 13,
    SESSION_DESTROYED = 14,
  }
}

