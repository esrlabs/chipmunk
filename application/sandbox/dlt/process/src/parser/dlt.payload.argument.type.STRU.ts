import { Buffer } from 'buffer';
import * as PayloadConsts from './dlt.payload.arguments.consts';
import TypeInfo from './dlt.payload.argument.type.info';

export interface IData {
    value: Buffer;
    name: string | undefined;
    count: number;
}

export default class STRG {

    private _buffer: Buffer;
    private _info: TypeInfo;
    private _offset: number = 0;

    constructor(buffer: Buffer, info: TypeInfo) {
        this._buffer = buffer;
        this._info = info;
    }

    public getData(): IData {
        const result: IData = { value: new Buffer(0), count: 0, name: undefined };
        result.count = this._buffer.readUInt16LE(this._offset);
        this._offset += 2;
        result.name = this._getName();
        // Here is implementation
        this._offset += length;
        return result;
    }

    public crop() {
        return this._buffer.slice(this._offset, this._buffer.length);
    }

    private _getName(): string | undefined {
        if (!this._info.VARI) {
            return undefined;
        }
        const length = this._buffer.readUInt16LE(0);
        this._offset += 2;
        const value = this._buffer.slice(this._offset, this._offset + length).toString('ascii');
        this._offset += length;
        return value;
    }

}