import { Buffer } from 'buffer';

export const HeaderExtendedFlags = {
    VERB: 0b00000001,
    MSTP: 0b00001110,
    MTIN: 0b11110000,
}

export enum EMSTP {
    DLT_TYPE_LOG        = 'DLT_TYPE_LOG',
    DLT_TYPE_APP_TRACE  = 'DLT_TYPE_APP_TRACE',
    DLT_TYPE_NW_TRACE   = 'DLT_TYPE_NW_TRACE',
    DLT_TYPE_CONTROL    = 'DLT_TYPE_CONTROL',
    // Default
    UNDEFINED           = 'UNDEFINED'
}

const MSTPMap: { [key: number]: EMSTP } = {
    0x00: EMSTP.DLT_TYPE_LOG,
    0x01: EMSTP.DLT_TYPE_APP_TRACE,
    0x02: EMSTP.DLT_TYPE_NW_TRACE,
    0x03: EMSTP.DLT_TYPE_CONTROL,
}

export enum EMTIN {
    // If MSTP == DLT_TYPE_LOG  
    DLT_LOG_FATAL           = 'DLT_LOG_FATAL',    
    DLT_LOG_ERROR           = 'DLT_LOG_ERROR',    
    DLT_LOG_WARN            = 'DLT_LOG_WARN',    
    DLT_LOG_INFO            = 'DLT_LOG_INFO',    
    DLT_LOG_DEBUG           = 'DLT_LOG_DEBUG',    
    DLT_LOG_VERBOSE         = 'DLT_LOG_VERBOSE',
    // If MSTP == DLT_TYPE_APP_TRACE    
    DLT_TRACE_VARIABLE      = 'DLT_TRACE_VARIABLE',    
    DLT_TRACE_FUNCTION_IN   = 'DLT_TRACE_FUNCTION_IN',    
    DLT_TRACE_FUNCTION_OUT  = 'DLT_TRACE_FUNCTION_OUT',    
    DLT_TRACE_STATE         = 'DLT_TRACE_STATE',
    DLT_TRACE_VFB           = 'DLT_TRACE_VFB',
    // If MSTP == DLT_TYPE_NW_TRACE  
    DLT_NW_TRACE_IPC        = 'DLT_NW_TRACE_IPC',    
    DLT_NW_TRACE_CAN        = 'DLT_NW_TRACE_CAN',    
    DLT_NW_TRACE_FLEXRAY    = 'DLT_NW_TRACE_FLEXRAY',    
    DLT_NW_TRACE_MOST       = 'DLT_NW_TRACE_MOST',
    // If MSTP == DLT_TYPE_CONTROL  
    DLT_CONTROL_REQUEST     = 'DLT_CONTROL_REQUEST',    
    DLT_CONTROL_RESPONSE    = 'DLT_CONTROL_RESPONSE',    
    DLT_CONTROL_TIME        = 'DLT_CONTROL_TIME',
    // Default
    UNDEFINED               = 'UNDEFINED'    
}

const MTINMap: { [key: string]: { [key: number]: EMTIN } } = {
    [EMSTP.DLT_TYPE_LOG]: {
        0x01: EMTIN.DLT_LOG_FATAL,
        0x02: EMTIN.DLT_LOG_ERROR,
        0x03: EMTIN.DLT_LOG_WARN,
        0x04: EMTIN.DLT_LOG_INFO,
        0x05: EMTIN.DLT_LOG_DEBUG,
        0x06: EMTIN.DLT_LOG_VERBOSE  
    },
    [EMSTP.DLT_TYPE_APP_TRACE]: {
        0x01: EMTIN.DLT_TRACE_VARIABLE,
        0x02: EMTIN.DLT_TRACE_FUNCTION_IN,
        0x03: EMTIN.DLT_TRACE_FUNCTION_OUT,
        0x04: EMTIN.DLT_TRACE_STATE,
        0x05: EMTIN.DLT_TRACE_VFB, 
    },
    [EMSTP.DLT_TYPE_NW_TRACE]: {
        0x01: EMTIN.DLT_NW_TRACE_IPC,
        0x02: EMTIN.DLT_NW_TRACE_CAN,
        0x03: EMTIN.DLT_NW_TRACE_FLEXRAY,
        0x04: EMTIN.DLT_NW_TRACE_MOST,  
    },
    [EMSTP.DLT_TYPE_CONTROL]: {
        0x01: EMTIN.DLT_CONTROL_REQUEST,
        0x02: EMTIN.DLT_CONTROL_RESPONSE,
        0x03: EMTIN.DLT_CONTROL_TIME
    },
}

export class Header {
    
    public MSIN: number = -1;               // Message Info
    public VERB: boolean = false;           // Verbose
    public MSTP: EMSTP = EMSTP.UNDEFINED;   // Message Type
    public MTIN: EMTIN = EMTIN.UNDEFINED;   // Message Type Info
    public NOAR: number = -1;               // Number of arguments
    public APID: string = '';               // Application ID
    public CTID: string = '';               // Context ID 

    private _buffer: Buffer;
    private _offset: number = 0;

    constructor(buffer: Buffer) {
        this._buffer = buffer;
        this.MSIN = this._buffer.readUInt8(this._offset);
        this._offset += 1;
        this.VERB = (this.MSIN & HeaderExtendedFlags.VERB) !== 0;
        const MSTPValue: number = (this.MSIN & HeaderExtendedFlags.MSTP) >> 1;
        if (MSTPMap[MSTPValue] !== undefined) {
            this.MSTP = MSTPMap[MSTPValue];
        }
        const MTINRelatedMap: { [key: number]: EMTIN } = MTINMap[this.MSTP];
        if (MTINRelatedMap !== undefined) {
            const MTINValue: number  = (this.MSIN & HeaderExtendedFlags.MTIN) >> 4;
            if (MTINRelatedMap[MTINValue] !== undefined) {
                this.MTIN = MTINRelatedMap[MTINValue];
            }
        }
        this.NOAR = this._buffer.readUInt8(this._offset);
        this._offset += 1;
        this.APID = this._buffer.slice(this._offset, this._offset + 4).toString('ascii');
        this._offset += 4;
        this.CTID = this._buffer.slice(this._offset, this._offset + 4).toString('ascii');
        this._offset += 4;
    }

    public getOffset(): number {
        return this._offset;
    }
}
