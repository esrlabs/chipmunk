import { OpenDialogOptions } from '../../interfaces/interface.electron';

export interface IElectronEnvShowOpenDialogRequest {
    options: OpenDialogOptions;
}

export class ElectronEnvShowOpenDialogRequest{

    public static signature: string = 'ElectronEnvShowOpenDialogRequest';
    public signature: string = ElectronEnvShowOpenDialogRequest.signature;
    public options: OpenDialogOptions = {};

    constructor(params: IElectronEnvShowOpenDialogRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ElectronEnvShowOpenDialogRequest message`);
        }
        if (typeof params.options !== 'object' || params.options === null) {
            throw new Error(`Expecting options would be an object`);
        }
        this.options = params.options;
    }
}
