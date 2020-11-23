export interface IFileListRequest {
    files: string[];
    session: string;
}

export class FileListRequest {
    public static signature: string = 'FileListRequest';
    public signature: string = FileListRequest.signature;
    public files: string[];
    public session: string;

    constructor(params: IFileListRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileListRequest message`);
        }
        if (!(params.files instanceof Array)) {
            throw new Error(`Field "files" should of type <string[]>`)
        }
        params.files.forEach((file: string) => {
            if (typeof file !== 'string' || file.trim() === '') {
                throw new Error(`Elements of files should be of type <string>`);
            }
        });
        this.session = params.session;
        this.files = params.files;
    }
}
