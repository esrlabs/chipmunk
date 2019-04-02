import { Buffer } from 'buffer';
import PayloadArgument, { IArgumentData } from './dlt.payload.argument';
import * as PayloadConsts from './dlt.payload.arguments.consts';

export interface IArgumentValue {
    type: PayloadConsts.EType;
    data: any;
}

export default class PayloadVerbose {
    
    private _buffer: Buffer;
    private _NOAR: number;

    constructor(buffer: Buffer, NOAR: number) {
        this._buffer = buffer;
        this._NOAR = NOAR; // Count of expected arguments
    }

    public getData(): IArgumentValue[] {
        const result: IArgumentValue[] = [];
        do {
            const argument: PayloadArgument = new PayloadArgument(this._buffer);
            const data: IArgumentData = argument.getData();
            this._buffer = data.cropped;
            result.push({
                type: data.type,
                data: data.data
            });
        } while (this._buffer.length > 0 || result.length < this._NOAR);
        return result;
    }

}
