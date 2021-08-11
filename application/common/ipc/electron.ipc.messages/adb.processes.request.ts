export interface IAdbProcessesRequest {
    session: string;
    device: string;
}

export class AdbProcessesRequest {

    public static signature: string = 'AdbProcessesRequest';
    public signature: string = AdbProcessesRequest.signature;
    public session: string;
    public device: string;

    constructor(params: IAdbProcessesRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for AdbProcessesRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (typeof params.device !== 'string' || params.device.trim() === '') {
            throw new Error(`Expecting device to be a string`);
        }
        this.session = params.session;
        this.device = params.device;
    }
}
