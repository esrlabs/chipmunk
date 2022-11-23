import { ParserName } from 'platform/types/observe';
import { Source } from 'platform/types/transport';

import * as Requests from 'platform/ipc/request';

export function handler(type: ParserName, source?: Source): Promise<void> {
    return new Promise((resolve, reject) => {
        Requests.IpcRequest.send(
            Requests.Actions.Stream.Response,
            new Requests.Actions.Stream.Request({ type, source }),
        ).then((response) => {
            if (response.error === undefined) {
                return resolve();
            }
            reject(new Error(response.error));
        });
    });
}
