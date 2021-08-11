import { IAdbDevice } from "../../interfaces/interface.adb";

export interface IAdbDevicesResponse {
    devices?: IAdbDevice[];
    error?: string;
}

export class AdbDevicesResponse {

    public static signature: string = 'AdbDevicesResponse';
    public signature: string = AdbDevicesResponse.signature;
    public error?: string;
    public devices?: IAdbDevice[];

    constructor(params: IAdbDevicesResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for AdbDevicesResponse message`);
        }
        if (params.error !== undefined && (typeof params.error !== 'string' || params.error.trim() === '')) {
            throw new Error(`Expecting error to be a string`);
        }
        if (params.devices !== undefined && !(params.devices instanceof Array)) {
            throw new Error(`Expecting devices to be an Array<IAdbDevice>`);
        }
        this.error = params.error;
        this.devices = params.devices
    }
}
