export interface OperationDone {
    uuid: string;
    result: string | null;
}
import { NativeError } from "./error";
import { FilterMatchList } from "./miscellaneous";
import { Progress } from "./progress";
import { AttachmentInfo } from "./attachment";
export interface CallbackEvent {
    StreamUpdated?: number;
    FileRead?: null;
    SearchUpdated?: [number, Map<string, number>];
    IndexedMapUpdated?: number;
    SearchMapUpdated?: FilterMatchList | null;
    SearchValuesUpdated?: Map<number, [number, number]> | null;
    AttachmentsUpdated?: [number, AttachmentInfo];
    Progress?: [string, Progress];
    SessionError?: NativeError;
    OperationError?: [string, NativeError];
    OperationStarted?: string;
    OperationProcessing?: string;
    OperationDone?: OperationDone;
    SessionDestroyed?: null;
}
