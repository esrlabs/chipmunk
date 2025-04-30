import * as Requests from 'platform/ipc/request';

export function handler(): Promise<void> {
    return Requests.IpcRequest.send(
        Requests.Actions.ThemeLight.Response,
        new Requests.Actions.ThemeLight.Request(),
    ).then(() => {
        return Promise.resolve();
    });
}
