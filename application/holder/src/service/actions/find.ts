import * as Requests from 'platform/ipc/request';

export function handler(): Promise<void> {
    return Requests.IpcRequest.send(
        Requests.Actions.FindInSearch.Response,
        new Requests.Actions.FindInSearch.Request(),
    ).then(() => {
        return Promise.resolve();
    });
}
