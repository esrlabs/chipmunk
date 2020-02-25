import * as Toolkit from 'chipmunk.client.toolkit';
import ServiceElectronIpc, { IPCMessages } from '../service.electron.ipc';
import OutputRedirectionsService, { IRange } from './service.output.redirections';

export interface IExportAction {
    caller: () => void;
    caption: string;
    disabled: boolean;
}

export class OutputExportsService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('OutputExportsService');

    public getActions(session: string): Promise<IExportAction[]> {
        return new Promise<IExportAction[]>((resolve, reject) => {
            let selection: IRange[] | undefined = OutputRedirectionsService.getSelectionRanges(session);
            if (selection === undefined) {
                selection = [];
            }
            const converted: IPCMessages.IOutputSelectionRange[] = selection.map((range: IRange) => {
                return { from: range.start, to: range.end };
            });
            ServiceElectronIpc.request(new IPCMessages.OutputExportFeaturesRequest({
                session: session,
                selection: converted,
            }), IPCMessages.OutputExportFeaturesResponse).then((response: IPCMessages.OutputExportFeaturesResponse) => {
                resolve(response.actions.map((action: IPCMessages.IExportAction) => {
                    return {
                        caption: action.caption,
                        disabled: !action.enabled,
                        caller: this._caller.bind(this, session, converted, action.id),
                    };
                }));
            }).catch((err: Error) => {
                this._logger.warn(`Fail request export actions due error: ${err.message}`);
                reject(err);
            });
        });
    }

    private _caller(session: string, selection: IPCMessages.IOutputSelectionRange[], actionId: string) {
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
