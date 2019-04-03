import { Buffer } from 'buffer';
import * as Standard from './dlt.header.standard';
import * as Extended from './dlt.header.extended';

export { Standard, Extended };

export default class Header {
    
    public standard: Standard.Header | undefined;
    public extended: Extended.Header | undefined;

    private _buffer: Buffer;
    private _offset: number = 0;

    constructor(buffer: Buffer) {
        this._buffer = buffer;
    }

    public read(): Error | undefined {
        // Create standard header first
        this.standard = new Standard.Header(this._buffer);
        // Try to read
        const readStandardHeaderError: Error | undefined = this.standard.read();
        if (readStandardHeaderError instanceof Error) {
            return readStandardHeaderError;
        }
        this._offset += this.standard.getOffset();
        // Get extended header (if it's defiend)
        if (this.standard.UEH) {
            // Create extended header
            this.extended = new Extended.Header(this._buffer);
            // Try to read
            const readExtendedHeaderError: Error | undefined = this.extended.read();
            if (readExtendedHeaderError instanceof Error) {
                return readExtendedHeaderError;
            }
            this._offset += this.extended.getOffset();
        }

    }

    public getOffset(): number {
        return this._offset;
    }

}