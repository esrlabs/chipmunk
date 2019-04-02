import { Buffer } from 'buffer';
import * as PayloadConsts from './dlt.payload.arguments.consts';
import TypeInfo from './dlt.payload.argument.type.info';

export interface IData {
    value: string;
    name: string | undefined;
}

export default class STRG{

    private _buffer: Buffer;
    private _info: TypeInfo;
    private _offset: number = 0;

    constructor(buffer: Buffer, info: TypeInfo) {
        this._buffer = buffer;
        this._info = info;
    }

    public getData(): IData {
        const result: IData = { value: '', name: undefined };
        const length: number = this._buffer.readUInt16LE(this._offset);
        this._offset += 2;
        result.name = this._getName();
        switch (this._info.SCODValue) {
            case 0:
                result.value = this._buffer.slice(this._offset, this._offset + length).toString('ascii');
                break;
            case 1:
                result.value = this._buffer.slice(this._offset, this._offset + length).toString('utf8');
                break;
            default:
                result.value = this._buffer.slice(this._offset, this._offset + length).toString('utf8');
                break;
        }
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