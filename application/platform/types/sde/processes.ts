export interface SdeRequest {
    WriteText?: string;
    WriteBytes?: number[];
}

export interface WriteResponse {
    bytes: number;
}

export interface SdeResponse {
    WriteText?: WriteResponse;
    WriteBytes?: WriteResponse;
    Error?: string;
}
