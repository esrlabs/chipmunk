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