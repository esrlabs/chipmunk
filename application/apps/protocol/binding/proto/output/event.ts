import { Ticks } from "./progress";
export interface DetailOneof {
    Ticks?: Ticks;
    Notification?: Notification;
    Stopped?: boolean;
}
export interface SearchMapUpdated {
    update: string;
}
import { NativeError } from "./error";
export interface EventOneof {
    StreamUpdated?: number;
    FileRead?: boolean;
    SearchUpdated?: SearchUpdated;
    IndexedMapUpdated?: IndexedMapUpdated;
    SearchMapUpdated?: SearchMapUpdated;
    SearchValuesUpdated?: SearchValuesUpdated;
    AttachmentsUpdated?: AttachmentsUpdated;
    Progress?: Progress;
    SessionError?: NativeError;
    OperationError?: OperationError;
    OperationStarted?: string;
    OperationProcessing?: string;
    OperationDone?: OperationDone;
    SessionDestroyed?: boolean;
}
export interface IndexedMapUpdated {
    len: number;
}
export interface CallbackEvent {
    event_oneof: EventOneof | null;
}
export interface ProgressDetail {
    detail_oneof: DetailOneof | null;
}
export interface OperationDone {
    uuid: string;
    result: string;
}
export interface OperationError {
    uuid: string;
    error: NativeError | null;
}
export interface Notification {
    severity: number;
    content: string;
    line: number;
}
export interface SearchUpdated {
    found: number;
    stat: Map<string, number>;
}
export interface SearchValuesUpdated {
    values: Map<number, ValueRange>;
}
export interface ValueRange {
    min: number;
    max: number;
}
import { AttachmentInfo } from "./attachment";
export interface AttachmentsUpdated {
    len: number;
    attachment: AttachmentInfo | null;
}
export interface Progress {
    uuid: string;
    detail: ProgressDetail | null;
}
