
export interface IFilesSearchResponse {
    matches: { [key: string]: number };
    error?: string;
}

export class FilesSearchResponse {

    public static signature: string = 'FilesSearchResponse';
    public signature: string = FilesSearchResponse.signature;
    public matches: { [key: string]: number } = {};
    public error?: string;

    constructor(params: IFilesSearchResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FilesSearchResponse message`);
        }
        if (typeof params.matches !== 'object' || params.matches === null) {
            throw new Error(`matches should be defined.`);
        }
        this.matches = params.matches;
        this.error = params.error;
    }
}
