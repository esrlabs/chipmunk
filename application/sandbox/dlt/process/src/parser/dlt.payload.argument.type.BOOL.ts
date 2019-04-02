import { Buffer } from 'buffer';
import * as PayloadConsts from './dlt.payload.arguments.consts';
import TypeInfo from './dlt.payload.argument.type.info';

export interface IData {
    value: boolean;
    name: string | undefined;
}

export default class BOOL{

    private _buffer: Buffer;
    private _info: TypeInfo;
    private _offset: number = 0;

    constructor(buffer: Buffer, info: TypeInfo) {
        this._buffer = buffer;
        this._info = info;
    }

    public getData(): IData {
        const name: string | undefined = this._getName();
        const value: boolean = this._buffer.readUInt8(this._offset) === 1;
        this._offset += 1;
        return {
            value: value,
            name: name
        }
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