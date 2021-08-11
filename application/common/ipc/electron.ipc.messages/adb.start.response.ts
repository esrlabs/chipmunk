export interface IAdbStartResponse {
    guid?: string;
    error?: string;
}

export class AdbStartResponse {

    public static signature: string = 'AdbStartResponse';
    public signature: string = AdbStartResponse.signature;
    public guid?: string;
    public error?: string;

    constructor(params: IAdbStartResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for AdbStartResponse message`);
        }
        if (params.guid !== undefined && (typeof params.guid !== 'string' || params.guid.trim() === '')) {
            throw new Error(`Expecting guid to be a string`);
        }
        if (params.error !== undefined && (typeof params.error !== 'string' || params.error.trim() === '')) {
            throw new Error(`Expecting error to be a string`);
        }
        this.guid = params.guid;
        this.error = params.error;
    }

}
