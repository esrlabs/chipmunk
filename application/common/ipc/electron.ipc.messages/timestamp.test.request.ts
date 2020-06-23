
import { ICheckFormatFlags } from '../../interfaces/interface.detect';

export { ICheckFormatFlags };

export interface ITimestampTestRequest {
    id: string;
    session: string;
    format: string;
    flags?: ICheckFormatFlags;
}

export class TimestampTestRequest {

    public static signature: string = 'TimestampTestRequest';
    public signature: string = TimestampTestRequest.signature;
    public id: string = '';
    public session: string = '';
    public format: string = '';
    public flags: ICheckFormatFlags;

    constructor(params: ITimestampTestRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TimestampTestRequest message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (typeof params.format !== 'string' || params.format.trim() === '') {
            throw new Error(`format should be defined.`);
        }
        if (typeof params.flags === 'object' && params.flags !== null) {
            this.flags = params.flags;
        } else {
            this.flags = { miss_day: false, miss_month: false, miss_year: false };
        }
        this.id = params.id;
        this.session = params.session;
        this.format = params.format;
    }
}
