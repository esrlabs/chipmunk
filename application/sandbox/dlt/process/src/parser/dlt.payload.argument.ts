import { Buffer } from 'buffer';
import * as PayloadConsts from './dlt.payload.arguments.consts';
import TypeInfo from './dlt.payload.argument.type.info';
import { IPayloadTypeProcessor } from './interface.dlt.payload.argument.type.processor';

import BOOL from './dlt.payload.argument.type.BOOL';
import FLOA from './dlt.payload.argument.type.FLOA';
import UINT from './dlt.payload.argument.type.UINT';
import SINT from './dlt.payload.argument.type.SINT';
import STRG from './dlt.payload.argument.type.STRG';
import STRU from './dlt.payload.argument.type.STRU';
import TRAI from './dlt.payload.argument.type.TRAI';
import RAWD from './dlt.payload.argument.type.RAWD';

const Processors: { [key: string]: any } = {
    BOOL: BOOL,
    FLOA: FLOA,
    UINT: UINT,
    SINT: SINT,
    STRG: STRG,
    STRU: STRU,
    TRAI: TRAI,
    RAWD: RAWD,
}

export const EType = PayloadConsts.EType;

export interface IArgumentData {
    type: PayloadConsts.EType;
    data: any;
    cropped: Buffer;
}

export default class PayloadArgument {
    
    public value: any;

    private _buffer: Buffer;
    private _info: TypeInfo | undefined;
    private _offset: number = 0;
    private _processor: IPayloadTypeProcessor<any> | undefined;

    constructor(buffer: Buffer) {
        this._buffer = buffer;
    }

    public read(): IArgumentData | Error {
        // Get type info
        this._info = new TypeInfo(this._buffer);
        this._offset += 4;
        // Get value
        const buffer: Buffer = this._buffer.slice(this._offset, this._buffer.length);
        // Looking for relevant processor
        if (Processors[this._info.type] === undefined) {
            return new Error(`Cannot find processor for type "${this._info.type}".`);
        }
        // Create processor
        this._processor = new Processors[this._info.type](buffer, this._info) as IPayloadTypeProcessor<any>;
        // Read data
        const data: any = this._processor.read();
        if (data instanceof Error) {
            return data;
        }
        const results: IArgumentData = {
            type: this._info.type,
            data: data,
            cropped: this._processor.crop(),
        };
        this._processor = undefined;
        return results;
    }
    
}