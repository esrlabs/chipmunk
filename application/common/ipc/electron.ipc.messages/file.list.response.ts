export interface IFileListResponse {
    files: IFile[];
    error?: string;
}

export interface IFile {
    modified: number;
    created: number;
    basename: string;
    path: string;
    filename: string;
    extention: string;
    size: number;
    hidden: boolean;
}

export class FileListResponse {
    public static signature: string = 'FileListResponse';
    public signature: string = FileListResponse.signature;
    public files: IFile[];
    public error?: string;

    constructor(params: IFileListResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileListResponse message`);
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
        this.files = params.files;
        this.error = params.error;
    }
}
