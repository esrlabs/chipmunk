export interface IRecentFileInfo {
    file: string;
    filename: string;
    folder: string;
    size: number;
    timestamp: number;
}

export interface IFilesRecentResponse {
    files: IRecentFileInfo[];
    error?: string;
}

export class FilesRecentResponse {

    public static signature: string = 'FilesRecentResponse';
    public signature: string = FilesRecentResponse.signature;
    public files: IRecentFileInfo[] = [];
    public error: string | undefined;

    constructor(params: IFilesRecentResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FilesRecentResponse message`);
        }
        if (!(params.files instanceof Array)) {
            throw new Error(`files should be defined.`);
        }
        this.files = params.files;
        this.error = params.error;
    }
}
