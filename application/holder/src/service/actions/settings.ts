import * as Requests from 'platform/ipc/request';

export function handler(): Promise<void> {
    return Requests.IpcRequest.send(
        Requests.Actions.Settings.Response,
        new Requests.Actions.Settings.Request(),
    ).then(() => {
        return Promise.resolve();
    });
}
