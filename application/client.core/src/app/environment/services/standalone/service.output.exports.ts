import * as Toolkit from 'chipmunk.client.toolkit';
import ServiceElectronIpc, { IPCMessages, Subscription } from '../service.electron.ipc';
import OutputRedirectionsService from './service.output.redirections';

export interface IExportAction {
    caller: () => void;
    caption: string;
    disabled: boolean;
}

export class OutputExportsService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('OutputExportsService');

    public getActions(session: string): Promise<IExportAction[]> {
        return new Promise<IExportAction[]>((resolve, reject) => {
            const selection: number[] = OutputRedirectionsService.getSelection(session);
            ServiceElectronIpc.request(new IPCMessages.OutputExportFeaturesRequest({
                session: session,
                selection: selection,
            }), IPCMessages.OutputExportFeaturesResponse).then((response: IPCMessages.OutputExportFeaturesResponse) => {
                resolve(response.actions.map((action: IPCMessages.IExportAction) => {
                    return {
                        caption: action.caption,
                        disabled: !action.enabled,
                        caller: this._caller.bind(this, session, selection, action.id),
                    };
                }));
            }).catch((err: Error) => {
                this._logger.warn(`Fail request export actions due error: ${err.message}`);
                reject(err);
            });
        });
    }

    private _caller(session: string, selection: number[], actionId: string) {
        ServiceElectronIpc.request(new IPCMessages.OutputExportFeatureCallRequest({
            actionId: actionId,
            session: session,
            selection: selection,
        }), IPCMessages.OutputExportFeatureCallResponse).then((response: IPCMessages.OutputExportFeatureCallResponse) => {
            if (response.error) {
                return this._logger.warn(`Fail to call action "${actionId}" due error: ${response.error}`);
            }
            this._logger.debug(`Action "${actionId}" done.`);
        }).catch((err: Error) => {
            this._logger.warn(`Fail to call action "${actionId}" due error: ${err.message}`);
        });
    }

}


export default (new OutputExportsService());
