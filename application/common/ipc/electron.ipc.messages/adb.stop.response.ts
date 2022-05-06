export interface IAdbStopResponse {
    error?: string
}

export class AdbStopResponse {

    public static signature: string = 'AdbStopResponse';
    public signature: string = AdbStopResponse.signature;
    public error?: string;

    constructor(params: IAdbStopResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for AdbStopResponse message`);
        }
        if (params.error !== undefined && (typeof params.error !== 'string' || params.error.trim() === '')) {
            throw new Error(`Expecting error to be a string`);
        }
        this.error = params.error;
    }
}
