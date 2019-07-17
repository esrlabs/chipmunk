import * as Toolkit from 'logviewer.client.toolkit';
export declare class SerialPortRowRenderAPI extends Toolkit.ATypedRowRenderAPIExternal {
    private _selector;
    constructor();
    getSelector(): string;
    getInputs(): {
        [key: string]: any;
    };
}
