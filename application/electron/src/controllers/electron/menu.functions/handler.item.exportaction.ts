import { IPCMessages } from '../../../services/service.electron';

import ServiceElectron from '../../../services/service.electron';
// import ServiceStreams from '../../../services/service.streams';
import ServiceOutputExport from '../../../services/output/service.output.export';
import Logger from '../../../tools/env.logger';

export default function exportActionCall(actionId: string) {
    /*
    const logger: Logger = new Logger(`exportActionCall`);
    const session: string = ServiceStreams.getActiveStreamId();
    if (session === '' || session === undefined) {
        logger.warn(`Cannot call action as soon as no any session there`);
        return;
    }
    ServiceElectron.IPC.request(new IPCMessages.OutputExportFeatureSelectionRequest({
        session: session,
        actionId: actionId,
    }), IPCMessages.OutputExportFeatureSelectionResponse).then((response: IPCMessages.OutputExportFeatureSelectionResponse) => {
        if (typeof response.error === 'string' && response.error.trim() !== '') {
            return logger.warn(`Fail to get selection due error: ${response.error}`);
        }
        ServiceOutputExport.callAction((new IPCMessages.OutputExportFeatureCallRequest({
            session: session,
            actionId: actionId,
            selection: response.selection,
        }))).catch((err: Error) => {
            logger.warn(`Fail call action "${actionId}" due error: ${err.message}`);
        });
    }).catch((err: Error) => {
        logger.error(`Fail to request selection due error: ${err.message}`);
    });
    */
}
