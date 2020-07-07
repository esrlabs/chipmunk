
export interface ITimestampExportCSVRequest {
    id: string;
    csv: string;
}

export class TimestampExportCSVRequest {

    public static signature: string = 'TimestampExportCSVRequest';
    public signature: string = TimestampExportCSVRequest.signature;
    public id: string = '';
    public csv: string = '';


    constructor(params: ITimestampExportCSVRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TimestampExportCSVRequest message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.csv !== 'string' || params.csv.trim() === '') {
            throw new Error(`csv should be defined.`);
        }
        this.id = params.id;
        this.csv = params.csv;
    }
}
