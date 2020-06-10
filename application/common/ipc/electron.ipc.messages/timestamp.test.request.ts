

export interface ITimestampTestRequest {
    id: string;
    session: string;
    format: string;
}

export class TimestampTestRequest {

    public static signature: string = 'TimestampTestRequest';
    public signature: string = TimestampTestRequest.signature;
    public id: string = '';
    public session: string = '';
    public format: string = '';


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
        this.id = params.id;
        this.session = params.session;
        this.format = params.format;
    }
}
