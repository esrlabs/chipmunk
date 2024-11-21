export interface SearchCommunication {
    message: string;
}
export interface Process {
    message: string;
}
export interface SessionUnavailable {
}
export interface ComputationError {
    comp_error_oneof: CompErrorOneof | null;
}
export interface SearchIoOperation {
    message: string;
}
export interface Aborted {
    message: string;
}
export interface SearchErrorOneof {
    SearchConfig?: SearchConfig;
    SearchCommunication?: SearchCommunication;
    SearchIoOperation?: SearchIoOperation;
    Regex?: Regex;
    Input?: Input;
    Grab?: Grab;
    Aborted?: Aborted;
}
export interface SearchConfig {
    message: string;
}
export interface Grab {
    error: GrabError | null;
}
export interface OperationNotSupported {
    message: string;
}
export interface InvalidData {
}
export interface Sde {
    message: string;
}
export interface Protocol {
    message: string;
}
export interface CompErrorOneof {
    DestinationPath?: DestinationPath;
    SessionCreatingFail?: SessionCreatingFail;
    CompCommunication?: CompCommunication;
    OperationNotSupported?: OperationNotSupported;
    CompIoOperation?: CompIoOperation;
    InvalidData?: InvalidData;
    InvalidArgs?: InvalidArgs;
    Process?: Process;
    Protocol?: Protocol;
    SearchError?: SearchError;
    MultipleInitCall?: MultipleInitCall;
    SessionUnavailable?: SessionUnavailable;
    NativeError?: NativeError;
    Grabbing?: Grabbing;
    Sde?: Sde;
}
export interface Interrupted {
}
export interface SearchError {
    search_error_oneof: SearchErrorOneof | null;
}
export enum NativeErrorKind {
    FileNotFound,
    UnsupportedFileType,
    ComputationFailed,
    Configuration,
    Interrupted,
    OperationSearch,
    NotYetImplemented,
    ChannelError,
    Io,
    Grabber,
}
export interface CompIoOperation {
    message: string;
}
export interface NativeError {
    severity: number;
    kind: number;
    message: string;
}
export interface GrabIoOperation {
    message: string;
}
export interface Regex {
    message: string;
}
export interface GrabCommunication {
    message: string;
}
export interface GrabErrorOneof {
    GrabConfig?: GrabConfig;
    GrabCommunication?: GrabCommunication;
    GrabIoOperation?: GrabIoOperation;
    InvalidRange?: InvalidRange;
    Interrupted?: Interrupted;
    NotInitialize?: NotInitialize;
    Unsupported?: Unsupported;
}
export interface GrabConfig {
    message: string;
}
export interface Input {
    message: string;
}
export interface GrabError {
    grab_error_oneof: GrabErrorOneof | null;
}
export enum Severity {
    Warning,
    Error,
}
import { RangeInclusive } from "./common";
export interface InvalidRange {
    range: RangeInclusive | null;
    context: string;
}
export interface CompCommunication {
    message: string;
}
export interface MultipleInitCall {
}
export interface NotInitialize {
}
export interface Grabbing {
    error: GrabError | null;
}
export interface Unsupported {
    message: string;
}
export interface DestinationPath {
}
export interface InvalidArgs {
    message: string;
}
export interface SessionCreatingFail {
}
