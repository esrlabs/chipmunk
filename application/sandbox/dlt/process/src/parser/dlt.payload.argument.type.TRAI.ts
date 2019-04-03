import { Buffer } from 'buffer';
import * as PayloadConsts from './dlt.payload.arguments.consts';
import TypeInfo from './dlt.payload.argument.type.info';
import { IPayloadTypeProcessor } from './interface.dlt.payload.argument.type.processor';

export interface IData {
    value: string;
}

export default class TRAI implements IPayloadTypeProcessor<IData> {

    private _buffer: Buffer;
    private _info: TypeInfo;
    private _offset: number = 0;

    constructor(buffer: Buffer, info: TypeInfo) {
        this._buffer = buffer;
        this._info = info;
    }

    public read(): IData | Error {
        const result: IData = { value: '' };
        const length: number = this._buffer.readUInt16LE(this._offset);
        this._offset += 2;
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

    public crop(): Buffer {
        return this._buffer.slice(this._offset, this._buffer.length);
    }

}