import { Buffer } from 'buffer';
import Header, { Standard, Extended } from './dlt.header';
import PayloadNonVerbose from './dlt.payload.nonverbose';
import PayloadVerbose from './dlt.payload.verbose';

export enum EMode {
    VERBOSE = 'VERBOSE',
    NON_VERBOSE = 'NON_VERBOSE'
}

export default class Payload {

    public mode: EMode = EMode.NON_VERBOSE;
    
    private _buffer: Buffer;
    private _header: Header;
    private _processor: PayloadNonVerbose | PayloadVerbose;

    constructor(buffer: Buffer, header: Header) {
        this._buffer = buffer;
        this._header = header;
        if (this._header.extended === undefined || !this._header.extended.VERB) {
            this.mode = EMode.NON_VERBOSE;
            this._processor = new PayloadNonVerbose(this._buffer);
        } else {
            this.mode = EMode.VERBOSE;
            this._processor = new PayloadVerbose(this._buffer, this._header.extended.NOAR);
        }
    }

    public getData(): any {
        return this._processor.getData();
    }

}
