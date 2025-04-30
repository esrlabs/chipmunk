import * as Requests from 'platform/ipc/request';

export function handler(): Promise<void> {
    return Requests.IpcRequest.send(
        Requests.Actions.ThemeDark.Response,
        new Requests.Actions.ThemeDark.Request(),
    ).then(() => {
        return Promise.resolve();
    });
}
