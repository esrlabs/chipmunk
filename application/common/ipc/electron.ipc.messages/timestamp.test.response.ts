import { ITimestampFormatOk } from '../../interfaces/interface.detect';

export interface ITimestampTestResponse {
    id: string;
    error?: string;
    format?: ITimestampFormatOk;
}

export class TimestampTestResponse {

    public static signature: string = 'TimestampTestResponse';
    public signature: string = TimestampTestResponse.signature;
    public id: string = '';
    public error?: string;
    public format?: ITimestampFormatOk;

    constructor(params: ITimestampTestResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TimestampTestResponse message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (params.format !== undefined && typeof params.format !== 'object' && params.format !== null) {
            throw new Error(`format should be defined as ITimestampFormatOk.`);
        }
        this.id = params.id;
        this.error = params.error;
        this.format = params.format;
    }
}

