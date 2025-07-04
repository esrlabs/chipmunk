import * as Requests from 'platform/ipc/request';
import { Ident } from 'platform/types/bindings';

export function handler(parser: Ident | undefined, source: Ident | undefined): Promise<void> {
    return new Promise((resolve, reject) => {
        Requests.IpcRequest.send(
            Requests.Actions.Stream.Response,
            new Requests.Actions.Stream.Request({ parser, source }),
        ).then((response) => {
            if (response.error === undefined) {
                return resolve();
            }
            reject(new Error(response.error));
        });
    });
}
