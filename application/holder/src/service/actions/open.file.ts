import { FileType } from 'platform/types/observe/types/file';

import * as Requests from 'platform/ipc/request';

export function handler(type: FileType | undefined): Promise<void> {
    return new Promise((resolve, reject) => {
        Requests.IpcRequest.send(
            Requests.Actions.OpenFile.Response,
            new Requests.Actions.OpenFile.Request({ type }),
        ).then((response) => {
            if (response.error === undefined) {
                return resolve();
            }
            reject(new Error(response.error));
        });
    });
}
