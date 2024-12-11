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
export interface NativeError {
    severity: Severity;
    kind: NativeErrorKind;
    message: string | null;
}
export enum Severity {
    WARNING,
    ERROR,
}
export interface ComputationError {
    DestinationPath?: null;
    SessionCreatingFail?: null;
    Communication?: string;
    OperationNotSupported?: string;
    IoOperation?: string;
    InvalidData?: null;
    InvalidArgs?: string;
    Process?: string;
    Protocol?: string;
    SearchError?: string;
    MultipleInitCall?: null;
    SessionUnavailable?: null;
    NativeError?: NativeError;
    Grabbing?: string;
    Sde?: string;
    Decoding?: string;
    Encoding?: string;
}
