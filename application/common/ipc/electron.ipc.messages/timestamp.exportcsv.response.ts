export interface ITimestampExportCSVResponse {
    id: string;
    error?: string;
}

export class TimestampExportCSVResponse {

    public static signature: string = 'TimestampExportCSVResponse';
    public signature: string = TimestampExportCSVResponse.signature;
    public id: string = '';
    public error?: string;

    constructor(params: ITimestampExportCSVResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TimestampExportCSVResponse message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        this.id = params.id;
        this.error = params.error;
    }
}

