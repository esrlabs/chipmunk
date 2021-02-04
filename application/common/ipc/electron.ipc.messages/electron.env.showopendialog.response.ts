import { OpenDialogReturnValue } from '../../interfaces/interface.electron';

export interface IElectronEnvShowOpenDialogResponse {
    error?: string;
    result?: OpenDialogReturnValue;
}

export class ElectronEnvShowOpenDialogResponse{

    public static signature: string = 'ElectronEnvShowOpenDialogResponse';
    public signature: string = ElectronEnvShowOpenDialogResponse.signature;
    public error?: string;
    public result?: OpenDialogReturnValue;

    constructor(params: IElectronEnvShowOpenDialogResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ElectronEnvShowOpenDialogResponse message`);
        }
        if (typeof params.result === 'object' && params.result !== null) {
            this.result = params.result;
        }
        if (typeof params.error === 'string' && params.error.trim() !== '') {
            this.error = params.error;
        }
    }
}
