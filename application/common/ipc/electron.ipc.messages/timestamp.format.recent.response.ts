export interface ITimestampFormatRecentResponse {
    formats: string[];
    error?: string;
}

export class TimestampFormatRecentResponse {

    public static signature: string = 'TimestampFormatRecentResponse';
    public signature: string = TimestampFormatRecentResponse.signature;
    public formats: string[] = [];
    public error: string | undefined;

    constructor(params: ITimestampFormatRecentResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TimestampFormatRecentResponse message`);
        }
        if (!(params.formats instanceof Array)) {
            throw new Error(`formats should be defined.`);
        }
        this.formats = params.formats;
        this.error = params.error;
    }
}
