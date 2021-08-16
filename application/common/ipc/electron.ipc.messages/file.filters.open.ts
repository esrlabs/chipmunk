export interface IFiltersOpen {
    file?: string;
    session: string;
}

export class FiltersOpen {

    public static signature: string = 'FiltersOpen';
    public signature: string = FiltersOpen.signature;
    public file?: string;
    public session: string;

    constructor(params: IFiltersOpen) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FiltersOpen message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expected session to be a string.`);
        }
        this.file = params.file;
        this.session = params.session;
    }        
}
