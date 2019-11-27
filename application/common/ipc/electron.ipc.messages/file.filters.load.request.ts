export interface IFiltersLoadRequest {
    file?: string;
}

export class FiltersLoadRequest {

    public static signature: string = 'FiltersLoadRequest';
    public signature: string = FiltersLoadRequest.signature;
    public file?: string;

    constructor(params: IFiltersLoadRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FiltersLoadRequest message`);
        }
        this.file = params.file;
    }
}
