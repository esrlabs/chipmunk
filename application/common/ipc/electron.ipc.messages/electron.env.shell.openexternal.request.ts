export interface IElectronEnvShellOpenExternalRequest {
    url: string;
}

export class ElectronEnvShellOpenExternalRequest{

    public static signature: string = 'ElectronEnvShellOpenExternalRequest';
    public signature: string = ElectronEnvShellOpenExternalRequest.signature;
    public url: string;

    constructor(params: IElectronEnvShellOpenExternalRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ElectronEnvShellOpenExternalRequest message`);
        }
        if (typeof params.url !== 'string' || params.url.trim() === '') {
            throw new Error(`url should be defined as string.`);
        }
        this.url = params.url;
    }
}
