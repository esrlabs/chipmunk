import * as Toolkit from 'logviewer.client.toolkit';
import { Observable, Subject } from 'rxjs';
import { IService } from '../interfaces/interface.service';
import ServiceElectronIpc, { IPCMessages, Subscription, TResponseFunc } from './service.electron.ipc';
import { AControllerFileOptions } from '../interfaces/interface.controller.file.options';
import { ControllerDltFileOptions } from '../controller/file.options/controller.file.dlt';
import EventsHubService from './standalone/service.eventshub';

enum EFileTypes {
    dlt = 'dlt'
}

const CControllers = {
    [EFileTypes.dlt]: ControllerDltFileOptions
};

export class FileOptionsService implements IService {

    private _subscription: Subscription | undefined;
    private _logger: Toolkit.Logger = new Toolkit.Logger('FileOptionsService');
    private _subjects = {
        onFileOpenRequest: new Subject<void>()
    };

    constructor() {

    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._subscription = ServiceElectronIpc.subscribe(IPCMessages.FileGetOptionsRequest, this._onRequest.bind(this));
            resolve();
        });
    }

    public getName(): string {
        return 'FileOptionsService';
    }

    public desctroy(): Promise<void> {
        return new Promise((resolve) => {
            if (this._subscription === undefined) {
                return resolve();
            }
            this._subscription.destroy();
            resolve();
        });
    }

    public getObservable(): {
        onFileOpenRequest: Observable<void>,
    } {
        return {
            onFileOpenRequest: this._subjects.onFileOpenRequest.asObservable(),
        };
    }

    private _onRequest(request: IPCMessages.FileGetOptionsRequest, response: TResponseFunc) {
        this._subjects.onFileOpenRequest.next();
        EventsHubService.getSubject().onKeepScrollPrevent.next();
        const fileType: string = request.type;
        if (CControllers[fileType] === undefined) {
            return response(new IPCMessages.FileGetOptionsResponse({
                allowed: true,
            })).catch((error: Error) => {
                this._logger.error(`Fail to send response due error: ${error.message}`);
            });
        }
        // Create instance of controller
        const inst: AControllerFileOptions = new CControllers[fileType](request);
        // Request options
        inst.getOptions(request).then((options: any) => {
            // Send options for file
            return response(new IPCMessages.FileGetOptionsResponse({
                allowed: true,
                options: options,
            })).catch((error: Error) => {
                this._logger.error(`Fail to send response for file "${fileType}" due error: ${error.message}`);
            });
        }).catch((getOptionsError: Error) => {
            this._logger.error(`Fail to get options for file "${fileType}" due error: ${getOptionsError.message}`);
            // Disallow opening file
            return response(new IPCMessages.FileGetOptionsResponse({
                allowed: false,
            })).catch((error: Error) => {
                this._logger.error(`Fail to send response due error: ${error.message}`);
            });
        });
    }

}

export default (new FileOptionsService());
