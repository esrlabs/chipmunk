import { Buffer } from 'buffer';
import Header, { Standard, Extended } from './dlt.header';
import Payload from './dlt.payload';

export default class DLTPacket {

    private _buffer: Buffer;
    private _header: Header | undefined;
    private _payload: Payload | undefined;

    constructor(buffer: Buffer) {
        this._buffer = buffer;
        // Get standard header
        this._header = new Header(this._buffer);
        // Extract payload part only
        const payload: Buffer = this._buffer.slice(this._header.getOffset(), this._header.standard.LEN);
        if (payload)

    }

    public crop() {

    }
}