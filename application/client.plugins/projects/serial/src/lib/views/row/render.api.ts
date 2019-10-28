// tslint:disable:no-inferrable-types

import * as Toolkit from 'chipmunk.client.toolkit';

export class SerialPortRowRenderAPI extends Toolkit.ATypedRowRenderAPIExternal {

    private _selector: string = 'lib-serial-row-component';

    constructor() {
        super();
    }

    public getSelector(): string {
        return this._selector;
    }
    public getInputs(): { [key: string]: any } {
        return {
            service: null,
        };
    }

}
