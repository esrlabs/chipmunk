import * as Requests from 'platform/ipc/request';

export function handler(): Promise<void> {
    return Requests.IpcRequest.send(
        Requests.Actions.ExportSessionState.Response,
        new Requests.Actions.ExportSessionState.Request(),
    ).then(() => {
        return Promise.resolve();
    });
}
