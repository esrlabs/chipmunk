import { Buffer } from 'buffer';
import * as PayloadConsts from './dlt.payload.arguments.consts';

export default class PayloadArgumentTypeInfo{

    public TYLE: boolean;
    public BOOL: boolean;
    public SINT: boolean;
    public UINT: boolean;
    public FLOA: boolean;
    public ARAY: boolean;
    public STRG: boolean;
    public RAWD: boolean;
    public VARI: boolean;
    public FIXP: boolean;
    public TRAI: boolean;
    public STRU: boolean;
    public SCOD: boolean;

    public TYLEValue: number;
    public SCODValue: number | undefined;

    public type: PayloadConsts.EType = PayloadConsts.EType.UNDEFINED;

    private _value: number;

    constructor(buffer: Buffer) {
        this._value = buffer.readUInt32LE(0);
        this.TYLE = (this._value & PayloadConsts.Flags.TYLE) !== 0;
        this.BOOL = (this._value & PayloadConsts.Flags.BOOL) !== 0;
        this.SINT = (this._value & PayloadConsts.Flags.SINT) !== 0;
        this.UINT = (this._value & PayloadConsts.Flags.UINT) !== 0;
        this.FLOA = (this._value & PayloadConsts.Flags.FLOA) !== 0;
        this.ARAY = (this._value & PayloadConsts.Flags.ARAY) !== 0;
        this.STRG = (this._value & PayloadConsts.Flags.STRG) !== 0;
        this.RAWD = (this._value & PayloadConsts.Flags.RAWD) !== 0;
        this.VARI = (this._value & PayloadConsts.Flags.VARI) !== 0;
        this.FIXP = (this._value & PayloadConsts.Flags.FIXP) !== 0;
        this.TRAI = (this._value & PayloadConsts.Flags.TRAI) !== 0;
        this.STRU = (this._value & PayloadConsts.Flags.STRU) !== 0;
        this.SCOD = (this._value & PayloadConsts.Flags.SCOD) !== 0;

        this.TYLEValue = (this._value & PayloadConsts.Masks.TYLE);
        this.SCODValue = this.SCOD ? (this._value & PayloadConsts.Masks.SCOD) : undefined;

        [   PayloadConsts.EType.BOOL, PayloadConsts.EType.SINT, PayloadConsts.EType.UINT,
            PayloadConsts.EType.FLOA, PayloadConsts.EType.ARAY, PayloadConsts.EType.STRG,
            PayloadConsts.EType.RAWD, PayloadConsts.EType.TRAI, PayloadConsts.EType.STRU].forEach((alias) => {
            if ((this as any)[alias]) {
                this.type = PayloadConsts.EType[alias];
            }
        });
    }

}