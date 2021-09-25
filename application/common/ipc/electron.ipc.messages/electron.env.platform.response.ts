export interface IElectronEnvPlatformResponse {
    platform: string;
}

export class ElectronEnvPlatformResponse {
    public static signature: string = 'ElectronEnvPlatformResponse';
    public signature: string = ElectronEnvPlatformResponse.signature;
    public platform: string;

    constructor(params: IElectronEnvPlatformResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ElectronEnvPlatformResponse message`);
        }
        if (typeof params.platform !== 'string' || params.platform.trim() === '') {
            throw new Error(`Expecting "platform" to be a not empty string`);
        }
        this.platform = params.platform;
    }
}
