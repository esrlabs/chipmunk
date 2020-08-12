import * as Toolkit from 'chipmunk.client.toolkit';
import ElectronIpcService, { IPCMessages } from '../service.electron.ipc';

export class ServiceOS {

    private os: string = '';

    private _logger: Toolkit.Logger = new Toolkit.Logger('ServiceOS');

    private _fetchOS(): Promise<string> {
        return new Promise((resolve) => {
            ElectronIpcService.request(new IPCMessages.OSInfoRequest(), IPCMessages.OSInfoResponse).then((response: IPCMessages.OSInfoResponse) => {
                if (response.error) {
                    return this._logger.error(`Fail to get OS due error: ${response.error}`);
                }
                this.os = response.os;
                return resolve(response.os);
            }).catch((error: Error) => {
                this._logger.error(`Fail send request to get OS due error: ${error.message}`);
            });
        });
    }

    public getOS(): Promise<string> {
        return new Promise((resolve) => {
            if (this.os.trim() === '') {
                this._fetchOS().then((os) => {
                    return resolve(os);
                });
            }
            resolve(this.os);
        });
    }
}

export default (new ServiceOS());
