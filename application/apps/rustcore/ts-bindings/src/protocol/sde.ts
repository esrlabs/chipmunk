export interface SdeResponse {
    bytes: number;
}
export interface RequestOneof {
    WriteText?: string;
    WriteBytes?: number[];
}
export interface SdeRequest {
    request_oneof: RequestOneof | null;
}
