import { IPC } from '../services/service.electron.ipc';

export abstract class AControllerFileOptions {
    abstract getOptions(request: IPC.FileGetOptionsRequest): Promise<any>;

    abstract reopen(file: string, options: any): Promise<any>;
}
