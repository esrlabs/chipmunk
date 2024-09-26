export interface SdeRequest {
    request_oneof: RequestOneof | null;
}
export interface RequestOneof {
    WriteText?: string;
    WriteBytes?: number[];
}
export interface SdeResponse {
    bytes: number;
}
