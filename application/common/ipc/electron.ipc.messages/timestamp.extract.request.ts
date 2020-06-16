

export interface ITimestampExtractRequest {
    id: string;
    session: string;
    format: string;
    str: string;
}

export class TimestampExtractRequest {

    public static signature: string = 'TimestampExtractRequest';
    public signature: string = TimestampExtractRequest.signature;
    public id: string = '';
    public session: string = '';
    public format: string = '';
    public str: string = '';


    constructor(params: ITimestampExtractRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TimestampExtractRequest message`);
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
        if (typeof params.str !== 'string' || params.str.trim() === '') {
            throw new Error(`str should be defined.`);
        }
        this.id = params.id;
        this.session = params.session;
        this.format = params.format;
        this.str = params.str;
    }
}
