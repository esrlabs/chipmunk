export interface ITimestampDiscoverRequest {
    id: string;
    session: string;
}

export class TimestampDiscoverRequest {

    public static signature: string = 'TimestampDiscoverRequest';
    public signature: string = TimestampDiscoverRequest.signature;
    public id: string = '';
    public session: string;

    constructor(params: ITimestampDiscoverRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TimestampDiscoverRequest message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        this.id = params.id;
        this.session = params.session;
    }
}
