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

export default class FLOA implements IPayloadTypeProcessor<IData> {

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
        result.name = names.name;
        result.unit = names.unit;
        switch (this._info.TYLEValue) {
            case 1: 
                // TODO: what is here? page: 87
                break;
            case 2: 
                result.value = this._toFloat16(this._buffer.readIntLE(this._offset, 2));
                this._offset += 2;
                break;
            case 3:
                result.value = this._buffer.readFloatLE(this._offset);
                this._offset += 4;
                break;
            case 4:
                result.value = this._buffer.readDoubleLE(this._offset);
                this._offset += 8;
                break;
            case 5: 
                // TODO: add support float 128
                result.value = 0;
                this._offset += 16;
                break;
        }
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

    private _toFloat16 (binary: number): number {
        // https://stackoverflow.com/questions/5678432/decompressing-half-precision-floats-in-javascript
        const s = (binary & 0x8000) >> 15;
        const e = (binary & 0x7C00) >> 10;
        const f = binary & 0x03FF;

        if(e == 0) {
            return (s?-1:1) * Math.pow(2,-14) * (f/Math.pow(2, 10));
        } else if (e == 0x1F) {
            return f?NaN:((s?-1:1)*Infinity);
        }
        return (s?-1:1) * Math.pow(2, e-15) * (1+(f/Math.pow(2, 10)));
    }

}