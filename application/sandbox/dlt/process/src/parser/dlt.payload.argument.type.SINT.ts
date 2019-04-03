import { Buffer } from 'buffer';
import * as PayloadConsts from './dlt.payload.arguments.consts';
import TypeInfo from './dlt.payload.argument.type.info';
import { IPayloadTypeProcessor } from './interface.dlt.payload.argument.type.processor';

export interface IData {
    value: number;
    name: string | undefined;
    unit: string | undefined;
}

interface IPointData {
    quantization: number | undefined;
    offset: number | undefined;
    bufferOffset: number;
}

export default class SINT implements IPayloadTypeProcessor<IData> {

    private _buffer: Buffer;
    private _info: TypeInfo;
    private _offset: number = 0;

    constructor(buffer: Buffer, info: TypeInfo) {
        this._buffer = buffer;
        this._info = info;
    }

    public read(): IData | Error {
        const result: IData = { name: undefined, unit: undefined, value: 0 };
        const names: { name: string | undefined, unit: string | undefined } = this._getName();
        const point: IPointData = this._getPoint();
        result.name = names.name;
        result.unit = names.unit;
        if (point. quantization !== undefined) {
            // TODO: implementation for this case
            // return result;
        }
        result.value = this._buffer.readIntLE(0, this._info.TYLEValue);
        this._offset += this._info.TYLEValue;
        return result;
    }

    public crop(): Buffer {
        return this._buffer.slice(this._offset, this._buffer.length);
    }

    private _getName(): { name: string | undefined, unit: string | undefined } {
        const name = { length: 0, value: '' };
        const unit = { length: 0, value: '' };
        if (!this._info.VARI) {
            return { name: undefined, unit: undefined };
        }
        name.length = this._buffer.readUInt16LE(0);
        this._offset += 2;
        unit.length = this._buffer.readUInt16LE(this._offset);
        this._offset += 2;
        name.value = this._buffer.slice(this._offset, this._offset + name.length).toString('ascii');
        this._offset += name.length;
        unit.value = this._buffer.slice(this._offset, this._offset + unit.length).toString('ascii');
        this._offset += unit.length;
        return {
            name: name.value,
            unit: unit.value
        }
    }

    private _getPoint(): IPointData {
        const result: IPointData = { quantization: undefined, offset: undefined, bufferOffset: 0 };
        if (!this._info.FIXP) {
            return result;
        }
        result.quantization = this._buffer.readFloatLE(this._offset);
        this._offset += 4;
        switch (this._info.TYLEValue) {
            case 1:
            case 2:
            case 3:
                result.offset = this._buffer.readUIntLE(this._offset, 4);
                this._offset += 4;
                break;
            case 4:
                result.offset = this._buffer.readUIntLE(this._offset, 8);
                this._offset += 8;
                break;
            case 5:
                result.offset = this._buffer.readUIntLE(this._offset, 16);
                this._offset += 16;
                break;
        }
        return result;
    }

}