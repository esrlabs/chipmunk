import * as $ from 'platform/types/observe';

import * as Requests from 'platform/ipc/request';

export function handler(
    protocol: $.Parser.Protocol,
    source?: $.Origin.Stream.Stream.Source,
): Promise<void> {
    return new Promise((resolve, reject) => {
        Requests.IpcRequest.send(
            Requests.Actions.Stream.Response,
            new Requests.Actions.Stream.Request({ protocol, source }),
        ).then((response) => {
            if (response.error === undefined) {
                return resolve();
            }
            reject(new Error(response.error));
        });
    });
}
