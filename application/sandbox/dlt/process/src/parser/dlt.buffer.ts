import { EventEmitter } from 'events';
import { Buffer } from 'buffer';
import Packet, { IPacketData } from './dlt.packet';

export default class DLTBuffer extends EventEmitter {

    public static Events = {
        packet: 'packet'
    }

    private _buffer: Buffer = new Buffer(0);

    constructor() {
        super();
    }

    public add(buffer: Buffer) {
        this._buffer = Buffer.concat([this._buffer, buffer]);
        while(this._read());
    }

    private _read(): boolean {
        const processor: Packet = new Packet(this._buffer);
        const packet: IPacketData | Error = processor.read();
        if (packet instanceof Error) {
            return false;
        }
        // Remove already read message from buffer
        this._buffer = processor.crop();
        // Trigger event
        this.emit(DLTBuffer.Events.packet, packet);
        return true;
    }

}
