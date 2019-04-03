import { Buffer } from 'buffer';

export default class PayloadNonVerbose {

    public messageId: number = -1;
    
    private _buffer: Buffer;
    private _offset: number = 0;

    constructor(buffer: Buffer) {
        this._buffer = buffer;
        this.messageId = this._buffer.readUInt32LE(this._offset);
        this._offset += 4;
    }

    public read(): any {
        return null;
    }

}
