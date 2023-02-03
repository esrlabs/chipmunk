import * as Requests from 'platform/ipc/request';

export function handler(): Promise<void> {
    return Requests.IpcRequest.send(
        Requests.Actions.Updates.Response,
        new Requests.Actions.Updates.Request(),
    ).then(() => {
        return Promise.resolve();
    });
}
