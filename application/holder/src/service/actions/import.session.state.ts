import * as Requests from 'platform/ipc/request';

export function handler(): Promise<void> {
    return Requests.IpcRequest.send(
        Requests.Actions.ImportSessionState.Response,
        new Requests.Actions.ImportSessionState.Request(),
    ).then(() => {
        return Promise.resolve();
    });
}
