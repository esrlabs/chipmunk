import { Buffer } from 'buffer';
import * as Standard from './dlt.header.standard';
import * as Extended from './dlt.header.extended';

export { Standard, Extended };

export default class Header {
    
    public standard: Standard.Header;
    public extended: Extended.Header | undefined;

    private _buffer: Buffer;
    private _offset: number = 0;

    constructor(buffer: Buffer) {
        this._buffer = buffer;
        // Get standard header first
        this.standard = new Standard.Header(this._buffer);
        this._offset += this.standard.getOffset();
        // Get extended header (if it's defiend)
        if (this.standard.UEH) {
            this.extended = new Extended.Header(this._buffer);
            this._offset += this.extended.getOffset();
        }
    }

    public getOffset(): number {
        return this._offset;
    }

}