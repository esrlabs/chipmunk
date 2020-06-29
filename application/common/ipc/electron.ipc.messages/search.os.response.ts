
export interface ISearchOSResponse {
    os?: string;
    error?: string;
}

export class SearchOSResponse {
    public static signature: string = 'SearchOSResponse';
    public signature: string = SearchOSResponse.signature;
    public error?: string;
    public os?: string;

    constructor(params: ISearchOSResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchOSResponse message`);
        }
        this.os = params.os;
        this.error = params.error;
    }
}
