import * as Requests from 'platform/ipc/request';

export function handler(): Promise<void> {
    return Requests.IpcRequest.send(
        Requests.Actions.PluginsManager.Response,
        new Requests.Actions.PluginsManager.Request(),
    ).then(() => {
        return Promise.resolve();
    });
}
