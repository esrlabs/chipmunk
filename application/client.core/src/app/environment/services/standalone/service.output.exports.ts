import * as Toolkit from 'chipmunk.client.toolkit';

import ServiceElectronIpc from '../service.electron.ipc';
import OutputRedirectionsService from './service.output.redirections';

import { IPC } from '../service.electron.ipc';
import { IRange } from './service.output.redirections';

export interface IExportAction {
    id: string;
    caller: () => void;
    caption: string;
    disabled: boolean;
}

export class OutputExportsService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('OutputExportsService');
    private _subscriptions: { [key: string]: Toolkit.Subscription } = {};

    constructor() {
        this._subscriptions.OutputExportFeatureSelectionRequest = ServiceElectronIpc.subscribe(
            IPC.OutputExportFeatureSelectionRequest,
            this._ipc_OutputExportFeatureSelectionRequest.bind(this),
        );
    }

    public getActions(
        session: string,
        source: IPC.EOutputExportFeaturesSource,
    ): Promise<IExportAction[]> {
        return new Promise<IExportAction[]>((resolve, reject) => {
            ServiceElectronIpc.request<IPC.OutputExportFeaturesResponse>(
                new IPC.OutputExportFeaturesRequest({
                    session: session,
                    source: source,
                }),
                IPC.OutputExportFeaturesResponse,
            )
                .then((response) => {
                    resolve(
                        response.actions.map((action: IPC.IExportAction) => {
                            return {
                                id: action.id,
                                caption: action.caption,
                                disabled: !action.enabled,
                                caller: this._caller.bind(this, session, action.id),
                            };
                        }),
                    );
                })
                .catch((err: Error) => {
                    this._logger.warn(`Fail request export actions due error: ${err.message}`);
                    reject(err);
                });
        });
    }

    private _caller(session: string, actionId: string) {
        OutputRedirectionsService.getOutputSelectionRanges(session)
            .then((selection: IRange[] | undefined) => {
                if (selection === undefined) {
                    selection = [];
                }
                const converted: IPC.IOutputSelectionRange[] = selection.map((range: IRange) => {
                    return { from: range.start.output, to: range.end.output };
                });
                ServiceElectronIpc.request<IPC.OutputExportFeatureCallResponse>(
                    new IPC.OutputExportFeatureCallRequest({
                        actionId: actionId,
                        session: session,
                        selection: converted,
                    }),
                    IPC.OutputExportFeatureCallResponse,
                )
                    .then((response) => {
                        if (response.error) {
                            this._logger.warn(
                                `Fail to call action "${actionId}" due error: ${response.error}`,
                            );
                        } else {
                            this._logger.debug(`Action "${actionId}" done.`);
                        }
                    })
                    .catch((err: Error) => {
                        this._logger.warn(
                            `Fail to call action "${actionId}" due error: ${err.message}`,
                        );
                    });
            })
            .catch((err: Error) => {
                this._logger.warn(`Fail request selection due error: ${err.message}`);
            });
    }

    private _ipc_OutputExportFeatureSelectionRequest(
        request: IPC.OutputExportFeatureSelectionRequest,
        response: (res: IPC.OutputExportFeatureSelectionResponse) => Promise<void>,
    ) {
        OutputRedirectionsService.getOutputSelectionRanges(request.session)
            .then((selection: IRange[] | undefined) => {
                if (selection === undefined) {
                    selection = [];
                }
                const converted: IPC.IOutputSelectionRange[] = selection.map((range: IRange) => {
                    return { from: range.start.output, to: range.end.output };
                });
                response(
                    new IPC.OutputExportFeatureSelectionResponse({
                        session: request.session,
                        selection: converted,
                    }),
                ).catch((err: Error) => {
                    this._logger.warn(
                        `Fail to send selection for action "${request.actionId}" due error: ${err.message}`,
                    );
                });
            })
            .catch((err: Error) => {
                this._logger.warn(`Fail request selection due error: ${err.message}`);
                response(
                    new IPC.OutputExportFeatureSelectionResponse({
                        session: request.session,
                        selection: [],
                        error: err.message,
                    }),
                ).catch((e: Error) => {
                    this._logger.warn(
                        `Fail to send selection for action "${request.actionId}" due error: ${e.message}`,
                    );
                });
            });
    }
}

export default new OutputExportsService();
