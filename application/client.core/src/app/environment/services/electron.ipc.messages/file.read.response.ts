export interface IFileReadResponse {
    content: string;
    error?: string;
    size: number;
}

export class FileReadResponse {

    public static signature: string = 'FileReadResponse';
    public signature: string = FileReadResponse.signature;
    public content: string = '';
    public error: string | undefined;
    public size: number = 0;

    constructor(params: IFileReadResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileReadResponse message`);
        }
        if (typeof params.content !== 'string' || params.content.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        if (typeof params.size !== 'number' || isNaN(params.size) || !isFinite(params.size)) {
            throw new Error(`file should be defined.`);
        }
        this.content = params.content;
        this.error = params.error;
        this.size = params.size;
    }
}
