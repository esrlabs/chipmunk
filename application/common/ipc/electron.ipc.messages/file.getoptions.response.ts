export interface IFileGetOptionsResponse {
    options: string;
}

export class FileGetOptionsResponse {

    public static signature: string = 'FileGetOptionsResponse';
    public signature: string = FileGetOptionsResponse.signature;
    public options: string = '';

    constructor(params: IFileGetOptionsResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileGetOptionsResponse message`);
        }
        if (typeof params.options !== 'string' || params.options.trim() === '') {
            throw new Error(`options should be defined as not empty string.`);
        }
        this.options = params.options;
    }
}
