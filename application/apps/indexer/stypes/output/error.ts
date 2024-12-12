export interface NativeError {
    severity: Severity;
    kind: NativeErrorKind;
    message: string | null;
}
export type ComputationError =
    "DestinationPath" |
    "SessionCreatingFail" |
    { Communication: string } |
    { OperationNotSupported: string } |
    { IoOperation: string } |
    "InvalidData" |
    { InvalidArgs: string } |
    { Process: string } |
    { Protocol: string } |
    { SearchError: string } |
    "MultipleInitCall" |
    "SessionUnavailable" |
    { NativeError: NativeError } |
    { Grabbing: string } |
    { Sde: string } |
    { Decoding: string } |
    { Encoding: string };
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
export enum Severity {
    WARNING,
    ERROR,
}
