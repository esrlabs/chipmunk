export interface IAdbLoadRequest {
    session: string;
}

export class AdbLoadRequest {

    public static signature: string = 'AdbLoadRequest';
    public signature: string = AdbLoadRequest.signature;
    public session: string;

    constructor(params: IAdbLoadRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for AdbLoadRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        this.session = params.session;
    }
}
