
export interface IOSInfoResponse {
    os?: string;
    error?: string;
}

export class OSInfoResponse {
    public static signature: string = 'OSInfoResponse';
    public signature: string = OSInfoResponse.signature;
    public error?: string;
    public os?: string;

    constructor(params: IOSInfoResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for OSInfoResponse message`);
        }
        this.os = params.os;
        this.error = params.error;
    }
}
