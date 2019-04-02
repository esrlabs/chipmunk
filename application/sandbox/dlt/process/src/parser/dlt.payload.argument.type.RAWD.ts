import { Buffer } from 'buffer';
import * as PayloadConsts from './dlt.payload.arguments.consts';
import TypeInfo from './dlt.payload.argument.type.info';

export interface IData {
    value: Buffer;
    name: string | undefined;
}

export default class RAWD {

    private _buffer: Buffer;
    private _info: TypeInfo;
    private _offset: number = 0;

    constructor(buffer: Buffer, info: TypeInfo) {
        this._buffer = buffer;
        this._info = info;
    }

    public getData(): IData {
        const result: IData = { value: new Buffer(0), name: undefined };
        const length: number = this._buffer.readUInt16LE(this._offset);
        this._offset += 2;
        result.name = this._getName();
        result.value = this._buffer.slice(this._offset, this._offset + length);
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