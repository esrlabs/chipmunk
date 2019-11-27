export interface IFiltersFilesRecentResetResponse {
    error?: string;
}

export class FiltersFilesRecentResetResponse {

    public static signature: string = 'FiltersFilesRecentResetResponse';
    public signature: string = FiltersFilesRecentResetResponse.signature;
    public error: string | undefined;

    constructor(params: IFiltersFilesRecentResetResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FiltersFilesRecentResetResponse message`);
        }
        this.error = params.error;
    }
}
