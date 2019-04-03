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

    public read(): IArgumentValue[] | Error {
        // Calculate minimal size of buffer. Size of TypeInfo is 4 bytes; TypeInfo should be presend for each argument
        const minSize: number = 4 * this._NOAR;
        // Check length of buffer
        if (this._buffer.byteLength < minSize) {
            return new Error(`NOAR is ${this._NOAR}, but size of buffer is ${this._buffer.byteLength} bytes. Minimal size requered: ${minSize} bytes.`);
        }
        const result: IArgumentValue[] = [];
        do {
            const argument: PayloadArgument = new PayloadArgument(this._buffer);
            const data: IArgumentData | Error = argument.read();
            if (data instanceof Error) {
                return data;
            }
            this._buffer = data.cropped;
            result.push({
                type: data.type,
                data: data.data
            });
        } while (this._buffer.length > 0 || result.length < this._NOAR);
        return result;
    }

}
