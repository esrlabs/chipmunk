import { IAdbProcess } from '../../interfaces/interface.adb';

export interface IAdbProcessesResponse {
    processes?: IAdbProcess[];
    error?: string;
}

export class AdbProcessesResponse {

    public static signature: string = 'AdbProcessesResponse';
    public signature: string = AdbProcessesResponse.signature;
    public error?: string;
    public processes?: IAdbProcess[];

    constructor(params: IAdbProcessesResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for AdbProcessesResponse message`);
        }
        if (params.error !== undefined && (typeof params.error !== 'string' || params.error.trim() === '')) {
            throw new Error(`Expecting error to be a string`);
        }
        if (params.processes !== undefined && !(params.processes instanceof Array)) {
            throw new Error(`Expecting processes to be an Array<IAdbProcess>`);
        }
        this.error = params.error;
        this.processes = params.processes
    }
}
