import * as Requests from 'platform/ipc/request';

export function handler(): Promise<void> {
    return Requests.IpcRequest.send(
        Requests.Actions.About.Response,
        new Requests.Actions.About.Request(),
    ).then(() => {
        return Promise.resolve();
    });
}
