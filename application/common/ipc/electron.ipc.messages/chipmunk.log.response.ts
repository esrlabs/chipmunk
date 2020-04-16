export interface IChipmunkLogResponse {
    error?: string;
}

export class ChipmunkLogResponse {
    public static signature: string = 'ChipmunkLogResponse';
    public signature: string = ChipmunkLogResponse.signature;
    public error?: string;

    constructor(params: IChipmunkLogResponse) {
        this.error = params.error;
    }
}
