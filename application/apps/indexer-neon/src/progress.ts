export enum AsyncResult {
    Completed,
    Interrupted,
    Aborted,
}
export interface ITicks {
    ellapsed: number,
    total: number,
}
export interface IChunk {
    rowsStart: number;
    rowsEnd: number;
    bytesStart: number;
    bytesEnd: number;
}
export interface INeonTransferChunk {
    r: [number, number];
    b: [number, number];
}
export interface ITimestampFormatResult {
    path: string,
    format?: string,
    minTime?: string,
    maxTime?: string,
}
export interface IConcatenatorResult {
    file_cnt: number,
    line_cnt: number,
    byte_cnt: number,
}
export interface IDiscoverItem {
    path: string,
}
export enum Severity {
    WARNING = 'WARNING',
    ERROR = 'ERROR',
}
export interface INeonNotification {
    severity: string,
    content: string,
    line?: number,
}