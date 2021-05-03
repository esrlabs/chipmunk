
export interface IFileInfoResponse {
    info?: any;                      // TODO: integrate interface here
    error?: string;
}

export class FileInfoResponse {

    public static signature: string = 'FileInfoResponse';
    public signature: string = FileInfoResponse.signature;
    public info: any | undefined;
    public error?: string;

    constructor(params: IFileInfoResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileInfoResponse message`);
        }
        this.info = params.info;
        this.error = params.error;
    }
}
