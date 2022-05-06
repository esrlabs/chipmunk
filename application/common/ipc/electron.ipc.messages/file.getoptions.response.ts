export interface IFileGetOptionsResponse {
    allowed: boolean;
    options?: any;
}

export class FileGetOptionsResponse {

    public static signature: string = 'FileGetOptionsResponse';
    public signature: string = FileGetOptionsResponse.signature;
    public allowed: boolean = true;
    public options: any = undefined;

    constructor(params: IFileGetOptionsResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileGetOptionsResponse message`);
        }
        if (typeof params.allowed !== 'boolean') {
            throw new Error(`allowed should be defined.`);
        }
        this.allowed = params.allowed;
        this.options = params.options;
    }
}
