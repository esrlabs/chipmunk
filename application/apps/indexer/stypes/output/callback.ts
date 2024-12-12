export interface OperationDone {
    uuid: string;
    result: string | null;
}
import { FilterMatchList } from "./miscellaneous";
import { Progress } from "./progress";
import { NativeError } from "./error";
import { AttachmentInfo } from "./attachment";
export type CallbackEvent =
    { StreamUpdated: number } |
    "FileRead" |
    {
        SearchUpdated: {
            found: number;
            stat: Map<string, number>
        }
    } |
    {
        IndexedMapUpdated: {
            len: number
        }
    } |
    { SearchMapUpdated: FilterMatchList | null } |
    { SearchValuesUpdated: Map<number, [number, number]> | null } |
    {
        AttachmentsUpdated: {
            len: number;
            attachment: AttachmentInfo
        }
    } |
    {
        Progress: {
            uuid: string;
            progress: Progress
        }
    } |
    { SessionError: NativeError } |
    {
        OperationError: {
            uuid: string;
            error: NativeError
        }
    } |
    { OperationStarted: string } |
    { OperationProcessing: string } |
    { OperationDone: OperationDone } |
    "SessionDestroyed";
