export interface IFileUnsupportedResponse {
    open: boolean;
}

export class FileUnsupportedResponse {
    public static signature: string = 'FileUnsupportedResponse';
    public signature: string = FileUnsupportedResponse.signature;
    public session: string = '';
    public open: boolean;

    constructor(params: IFileUnsupportedResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileUnsupportedResponse message`);
        }
        if (typeof params.open !== 'boolean') {
            throw new Error(`open should be defined as boolean.`);
        }
        this.open = params.open;
    }
}
