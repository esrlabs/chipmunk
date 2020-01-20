import { IStreamSourceNew } from './stream.source.new';

export interface IFileOpenResponse {
    error?: string;
    stream?: IStreamSourceNew;
    options?: any;
}

export class FileOpenResponse {

    public static signature: string = 'FileOpenResponse';
    public signature: string = FileOpenResponse.signature;
    public error: string | undefined;
    public stream?: IStreamSourceNew;
    public options?: any;

    constructor(params: IFileOpenResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileOpenResponse message`);
        }
        this.error = params.error;
        this.stream = params.stream;
        this.options = params.options;
    }
}
