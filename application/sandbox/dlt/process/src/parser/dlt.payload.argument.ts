import { Buffer } from 'buffer';
import * as PayloadConsts from './dlt.payload.arguments.consts';
import TypeInfo from './dlt.payload.argument.type.info';

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
    private _info: TypeInfo;
    private _offset: number = 0;
    private _processor: any;

    constructor(buffer: Buffer) {
        this._buffer = buffer;
        // Get type info
        this._info = new TypeInfo(this._buffer);
        this._offset += 4;
        // Get value
        const data: Buffer = this._buffer.slice(this._offset, this._buffer.length);
        // Looking for relevant processor
        if (Processors[this._info.type] === undefined) {
            throw new Error(`Cannot find processor for type "${this._info.type}".`);
        }
        // Create processor
        this._processor = new Processors[this._info.type](data, this._info);
    }

    public getData(): IArgumentData {
        if (this._processor === undefined) {
            throw new Error(`Data can be extracted only once.`);
        }
        const results: IArgumentData = {
            type: this._info.type,
            data: this._processor.getData(),
            cropped: this._processor.crop(),
        };
        this._processor = undefined;
        return results;
    }
    
}