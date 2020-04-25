import { ITimestampFormatOk } from '../../interfaces/interface.detect';

export interface IMergeFilesTestResponse {
    id: string;
    format?: ITimestampFormatOk;
    minTime?: string;
    maxTime?: string;
    path: string;
    error?: string;
}

export class MergeFilesTestResponse {

    public static signature: string = 'MergeFilesTestResponse';
    public signature: string = MergeFilesTestResponse.signature;
    public id: string = '';
    public format?: ITimestampFormatOk;
    public minTime?: string;
    public maxTime?: string;
    public path: string;
    public error?: string;

    constructor(params: IMergeFilesTestResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for MergeFilesTestResponse message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.path !== 'string' || params.path.trim() === '') {
            throw new Error(`path should be defined.`);
        }
        this.id = params.id;
        this.format = params.format;
        this.minTime = params.minTime;
        this.maxTime = params.maxTime;
        this.path = params.path;
        this.error = params.error;
    }
}
