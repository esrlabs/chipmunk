import { IPCMessages } from '../services/service.electron.ipc';

export abstract class AControllerFileOptions {

    abstract getOptions(request: IPCMessages.FileGetOptionsRequest): Promise<any>;

}
