export interface ITimestampExtractResponse {
    id: string;
    error?: string;
    timestamp?: number;
}

export class TimestampExtractResponse {

    public static signature: string = 'TimestampExtractResponse';
    public signature: string = TimestampExtractResponse.signature;
    public id: string = '';
    public error?: string;
    public timestamp?: number;

    constructor(params: ITimestampExtractResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TimestampExtractResponse message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (params.timestamp !== undefined && typeof params.timestamp !== 'number') {
            throw new Error(`timestamp should be defined as number.`);
        }
        this.id = params.id;
        this.error = params.error;
        this.timestamp = params.timestamp;
    }
}

