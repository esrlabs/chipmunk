import { ITimestampFormatOk } from '../../interfaces/interface.detect';

export interface ITimestampDiscoverResponse {
    id: string;
    error?: string;
    format?: ITimestampFormatOk;
    minTime?: number;
    maxTime?: number;
}

export class TimestampDiscoverResponse {

    public static signature: string = 'TimestampDiscoverResponse';
    public signature: string = TimestampDiscoverResponse.signature;
    public id: string = '';
    public error?: string;
    public format?: ITimestampFormatOk;
    public minTime?: number;
    public maxTime?: number;


    constructor(params: ITimestampDiscoverResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TimestampDiscoverResponse message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (params.format !== undefined && typeof params.format !== 'object' && params.format !== null) {
            throw new Error(`format should be defined as ITimestampFormatOk.`);
        }
        if (params.minTime !== undefined && typeof params.minTime !== 'number') {
            throw new Error(`minTime should be defined as number.`);
        }
        if (params.maxTime !== undefined && typeof params.maxTime !== 'number') {
            throw new Error(`maxTime should be defined as number.`);
        }
        this.id = params.id;
        this.error = params.error;
        this.format = params.format;
        this.minTime = params.minTime;
        this.maxTime = params.maxTime;
    }
}
