export interface IAdbStopRequest {
    session: string;
}

export class AdbStopRequest {

    public static signature: string = 'AdbStopRequest';
    public signature: string = AdbStopRequest.signature;
    public session: string;

    constructor(params: IAdbStopRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for AdbStopRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        this.session = params.session;
    }
}
