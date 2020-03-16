export interface IAppRestartResponse {
    error?: string;
}

export class AppRestartResponse {
    public static signature: string = 'AppRestartResponse';
    public signature: string = AppRestartResponse.signature;
    public error?: string;

    constructor(params: IAppRestartResponse) {
        this.error = params.error;
    }
}