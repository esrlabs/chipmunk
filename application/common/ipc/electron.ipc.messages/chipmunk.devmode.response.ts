export interface IChipmunkDevModeResponse {
    production: boolean;
}

export class ChipmunkDevModeResponse {
    public static signature: string = 'ChipmunkDevModeResponse';
    public signature: string = ChipmunkDevModeResponse.signature;
    public production: boolean;

    constructor(params: IChipmunkDevModeResponse) {
        this.production = params.production;
    }
}
