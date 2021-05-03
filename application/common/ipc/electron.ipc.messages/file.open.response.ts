import { IStreamSourceNew } from './stream.source.new';

export interface IFileOpenResponse {
    error?: string;
    canceled?: boolean;
}

export class FileOpenResponse {

    public static signature: string = 'FileOpenResponse';
    public signature: string = FileOpenResponse.signature;
    public error: string | undefined;
    public canceled: boolean | undefined;

    constructor(params: IFileOpenResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileOpenResponse message`);
        }
        this.error = params.error;
        this.canceled = params.canceled;
    }
}
