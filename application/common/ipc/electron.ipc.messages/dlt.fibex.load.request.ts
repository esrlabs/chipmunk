export interface IDLTFibexLoadRequest {
    dlt: string;
}

export class DLTFibexLoadRequest {
    public static signature: string = 'DLTFibexLoadRequest';
    public signature: string = DLTFibexLoadRequest.signature;
    public dlt: string;

    constructor(params: IDLTFibexLoadRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTFibexLoadRequest message`);
        }
        if (typeof params.dlt !== 'string' || params.dlt.trim() === '') {
            throw new Error(`dlt should not be an empty string`);
        }
        this.dlt = params.dlt;
    }
}
