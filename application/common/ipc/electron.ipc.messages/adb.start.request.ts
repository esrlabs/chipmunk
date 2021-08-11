export interface IAdbStartRequest {
    session: string;
    device: string;
    level: string;
    pid?: number;
}

export class AdbStartRequest {

    public static signature: string = 'AdbStartRequest';
    public signature: string = AdbStartRequest.signature;
    public session: string;
    public device: string;
    public level: string;
    public pid?: number;

    constructor(params: IAdbStartRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for AdbStartRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (typeof params.device !== 'string' || params.device.trim() === '') {
            throw new Error(`Expecting device to be a string`);
        }
        if (typeof params.level !== 'string' || params.level.trim() === '') {
            throw new Error(`Expecting level to be a string`);
        }
        if (params.pid !== undefined && typeof params.pid !== 'number') {
            throw new Error(`Expecting pid to be a number.`);
        }
        this.session = params.session;
        this.device = params.device;
        this.level = params.level;
        this.pid = params.pid;
    }
}
