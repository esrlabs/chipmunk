import { ITimestampFormat } from '../../../common/interfaces/interface.detect'
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
export interface IFormatCheckResult {
    FormatRegex?: string,
    FormatInvalid?: string,
}
export interface ITimestampByFormatResult {
    Timestamp?: number;
    Error?: string;
}
export interface ITimestampFormatResult {
    path: string,
    format?: ITimestampFormat,
    min_time?: number,
    max_time?: number,
}
export interface IConcatenatorResult {
    file_cnt: number,
    line_cnt: number,
    byte_cnt: number,
}
export interface IMergerItemOptions {
    path: string,
    offset?: number,
    year?: number,
    format: string,
    tag: string,
}
export interface IDiscoverItem {
    path: string,
    format_string?: string,
    fallback_year?: number,
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