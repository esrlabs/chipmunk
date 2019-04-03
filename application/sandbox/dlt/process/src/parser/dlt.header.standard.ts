import { Buffer } from 'buffer';

export const Parameters = {
    MIN_LEN: 4,
    MAX_LEN: 16
}

export const HeaderStandardFlags = {
    UEH : 0b00000001,
    MSBF: 0b00000010,
    WEID: 0b00000100,
    WSID: 0b00001000,
    WTMS: 0b00010000,
}

export const HeaderStandardMasks = {
    VERS: 0b11100000,
}

export class Header {

    public UEH      : boolean = false;  // Use Extended Header
    public MSBF     : boolean = false;  // MSB First
    public WEID     : boolean = false;  // With ECU ID
    public WSID     : boolean = false;  // With Session ID
    public WTMS     : boolean = false;  // With Timestamp
    public VERS     : number = -1;      // Version Number
    public MCNT     : number = -1;      // Message Counter
    public LEN      : number = -1;      // Length of the complete message in bytes
    public EID      : string = '';      // ECU ID (ECU)
    public SID      : number = -1;      // Session ID
    public TMS      : number = -1;      // Timestamp

    private _buffer: Buffer;
    private _offset: number = 0;

    constructor(buffer: Buffer) {
        this._buffer = buffer;
    }

    public read(): Error | undefined {
        if (this._buffer.length < Parameters.MIN_LEN) {
            return new Error(`Minimal length of standard header is ${Parameters.MIN_LEN} bytes, but size of buffer is ${this._buffer.byteLength} bytes.`);
        }
        const content = this._buffer.readUInt8(this._offset);
        // Check structure of header: what header includes
        ['UEH', 'MSBF', 'WEID', 'WSID', 'WTMS'].forEach((key: string) => {
            (this as any)[key] = (content & (HeaderStandardFlags as any)[key]) !== 0;
        });
        // Get version of protocol
        this.VERS = (content & HeaderStandardMasks.VERS) >> 5;
        this._offset += 1;
        // Get message counter
        this.MCNT = this._buffer.readUInt8(this._offset);
        this._offset += 1;
        // Get length 
        this.LEN = this._buffer.readUInt16LE(this._offset);
        this._offset += 2;
        // Calculate length of whole header
        let length = this._offset;
        if (this.WEID) { length += 4; }
        if (this.WSID) { length += 4; }
        if (this.WTMS) { length += 4; }
        if (this._buffer.byteLength < length) {
            return new Error(`Expected size of header is bigger than buffer. Some of parameters are defiend (WEID, WSID, WTMS), but no data in buffer.`);
        }
        // Check ECU ID (WEID)
        if (this.WEID) {
            this.EID = this._buffer.slice(this._offset, this._offset + 4).toString('ascii');
            this._offset += 4;
        }
        // Check session Id (WSID)
        if (this.WSID) {
            this.SID = this._buffer.readUInt32LE(this._offset);
            this._offset += 4;
        }
        // Check timestamp (WTMS)
        if (this.WTMS) {
            this.TMS = this._buffer.readUInt32LE(this._offset);
            this._offset += 4;
        }
    }

    public getOffset(): number {
        return this._offset;
    }

}
