import * as Toolkit from 'logviewer.client.toolkit';
import { SerialPortRowRenderAPI } from './render.api';
export declare class SerialPortRowRender extends Toolkit.ATypedRowRender<SerialPortRowRenderAPI> {
    private _api;
    constructor();
    getType(): Toolkit.ETypedRowRenders;
    isTypeMatch(sourceName: string): boolean;
    getAPI(): SerialPortRowRenderAPI;
}
