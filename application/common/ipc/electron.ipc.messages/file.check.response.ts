export interface IFileCheckResponse {
    guid: string;
    files: IFile[];
    error?: string;
}

interface IFile {
    lastModified: number;
    lastModifiedDate: Date;
    name: string;
    path: string;
    size: number;
    type: string;
}

export class FileCheckResponse {
    public static signature: string = 'FileCheckResponse';
    public signature: string = FileCheckResponse.signature;
    public guid: string;
    public files: IFile[];
    public error?: string;

    constructor(params: IFileCheckResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileCheckResponse message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        if (!(params.files instanceof Array)) {
            throw new Error(`Field "files" should of type <string[]>`)
        }
        params.files.forEach((file: IFile) => {
            if (file) {
                if (typeof file.path !== 'string' || file.path.trim() === '') {
                    throw new Error(`Elements of files should be of type <string>`);
                }
            }
        });
        this.guid = params.guid;
        this.files = params.files;
        this.error = params.error;
    }
}
