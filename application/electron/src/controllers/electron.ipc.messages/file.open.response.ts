export interface IFileOpenResponse {
    error?: string;
}

export class FileOpenResponse {

    public static signature: string = 'FileOpenResponse';
    public signature: string = FileOpenResponse.signature;
    public error: string | undefined;

    constructor(params: IFileOpenResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileOpenResponse message`);
        }
        this.error = params.error;
    }
}
