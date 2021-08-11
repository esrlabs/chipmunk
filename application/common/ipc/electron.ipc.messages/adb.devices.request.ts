export interface IAdbDevicesRequest {
    session: string;
}

export class AdbDevicesRequest {

    public static signature: string = 'AdbDevicesRequest';
    public signature: string = AdbDevicesRequest.signature;
    public session: string;

    constructor(params: IAdbDevicesRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for AdbDevicesRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        this.session = params.session;
    }
}
