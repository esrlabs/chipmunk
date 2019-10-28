import * as Toolkit from 'chipmunk.client.toolkit';
import { SerialPortRowRenderAPI } from './render.api';

export class SerialPortRowRender extends Toolkit.ATypedRowRender<SerialPortRowRenderAPI> {

    private _api: SerialPortRowRenderAPI = new SerialPortRowRenderAPI();

    constructor() {
        super();
    }

    public getType(): Toolkit.ETypedRowRenders {
        return Toolkit.ETypedRowRenders.external;
    }

    public isTypeMatch(sourceName: string): boolean {
        return sourceName === 'serial';
    }

    public getAPI(): SerialPortRowRenderAPI {
        return this._api;
    }

}
