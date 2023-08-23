import * as Requests from 'platform/ipc/request';

export function handler(): Promise<void> {
    return Requests.IpcRequest.send(
        Requests.Actions.Help.Response,
        new Requests.Actions.Help.Request(),
    ).then(() => {
        return Promise.resolve();
    });
}
