import * as Toolkit from 'chipmunk.client.toolkit';
import { DLTRowColumnsAPI } from './row.columns.api';
export declare function isDLTSource(sourceName: string, sourceMeta?: string): boolean;
export declare class DLTRowColumns extends Toolkit.ATypedRowRender<DLTRowColumnsAPI> {
    private _api;
    constructor();
    getType(): Toolkit.ETypedRowRenders;
    isTypeMatch(sourceName: string, sourceMeta?: string): boolean;
    getAPI(): DLTRowColumnsAPI;
}
