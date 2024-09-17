import * as Requests from 'platform/ipc/request';

export function handler(): Promise<void> {
    return Requests.IpcRequest.send(
        Requests.Actions.JumpTo.Response,
        new Requests.Actions.JumpTo.Request(),
    ).then(() => {
        return Promise.resolve();
    });
}
