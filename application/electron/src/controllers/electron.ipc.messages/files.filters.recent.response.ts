export interface IRecentFilterFileInfo {
    file: string;
    filename: string;
    folder: string;
    filters: number;
    timestamp: number;
}

export interface IFiltersFilesRecentResponse {
    files: IRecentFilterFileInfo[];
    error?: string;
}

export class FiltersFilesRecentResponse {

    public static signature: string = 'FiltersFilesRecentResponse';
    public signature: string = FiltersFilesRecentResponse.signature;
    public files: IRecentFilterFileInfo[] = [];
    public error: string | undefined;

    constructor(params: IFiltersFilesRecentResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FiltersFilesRecentResponse message`);
        }
        if (!(params.files instanceof Array)) {
            throw new Error(`files should be defined.`);
        }
        this.files = params.files;
        this.error = params.error;
    }
}
