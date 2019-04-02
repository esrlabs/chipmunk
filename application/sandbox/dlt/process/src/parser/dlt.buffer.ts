/**
* This file is a part of solution (dlt parser) created based on https://www.npmjs.com/package/dlt-node
*/

import { EventEmitter } from 'events';
import * as util from 'util';
import * as ByteBuffer from 'bytebuffer';

export default class DLTBuffer extends EventEmitter {

    public static Events = {
        packet: 'packet'
    }

    private _buffer: ByteBuffer = new ByteBuffer();

    constructor() {
        super();
    }

    public add(buffer: Buffer) {
        this._buffer.append(buffer);
        while (this._read());
    }

    private _read(): boolean {
        const length: number = this._buffer.offset;
        if (length < 3) {
            return false;
        }
        this._buffer.offset = 2;
        const packetLength = this._buffer.readInt16();
        if (packetLength > length) {
            this._buffer.offset = length;
            return false;
        }
        const packetByteBuffer: ByteBuffer = this._buffer.copy(0, packetLength);
        const packet: DLTPacket = new DltPacket(packetByteBuffer);
        this._buffer = this._buffer.copy(packetLength, length);
        this._buffer.offset = length - packetLength;
        return true;
    }

}
