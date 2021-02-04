export interface IElectronEnvShellOpenExternalResponse {
    error?: string;
}

export class ElectronEnvShellOpenExternalResponse{

    public static signature: string = 'ElectronEnvShellOpenExternalResponse';
    public signature: string = ElectronEnvShellOpenExternalResponse.signature;
    public error?: string;

    constructor(params: IElectronEnvShellOpenExternalResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ElectronEnvShellOpenExternalResponse message`);
        }
        if (typeof params.error === 'string' && params.error.trim() !== '') {
            this.error = params.error;
        }
    }
}
