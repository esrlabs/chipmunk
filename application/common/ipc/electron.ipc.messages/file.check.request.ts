export interface IFileCheckRequest {
    guid: string;
    files: string[];
}

export class FileCheckRequest {
    public static signature: string = 'FileCheckRequest';
    public signature: string = FileCheckRequest.signature;
    public guid: string;
    public files: string[];

    constructor(params: IFileCheckRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileCheckRequest message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        if (!(params.files instanceof Array)) {
            throw new Error(`Field "files" should of type <string[]>`)
        }
        params.files.forEach((file: string) => {
            if (typeof file !== 'string' || file.trim() === '') {
                throw new Error(`Elements of files should be of type <string>`);
            }
        });
        this.guid = params.guid;
        this.files = params.files;
    }
}
