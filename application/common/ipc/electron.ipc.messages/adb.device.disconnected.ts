export interface IAdbDeviceDisconnected {
    guid: string;
    device: string;
}

export class AdbDeviceDisconnected {
    public static signature: string = 'AdbDeviceDisconnected';
    public signature: string = AdbDeviceDisconnected.signature;
    public guid: string;
    public device: string;

    constructor(params: IAdbDeviceDisconnected) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for AdbDeviceDisconnected message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Expecting guid to be a string`);
        }
        if (typeof params.device !== 'string' || params.device.trim() === '') {
            throw new Error(`Expecting device to be a string`);
        }
        this.guid = params.guid;
        this.device = params.device;
    }
}
