import { CancelablePromise } from '@platform/env/promise';
import * as Requests from '@platform/ipc/request';
import { Action as FileAnyAction } from '@service/actions/file.any';

export function handler(
    request: Requests.Cli.MultiFiles.Request,
): CancelablePromise<Requests.Cli.MultiFiles.Response> {
    return new CancelablePromise(async (resolve, _reject) => {
        action(request);
        resolve(new Requests.Cli.MultiFiles.Response());
    });
}

export function action(request: Requests.Cli.MultiFiles.Request): void {
    if (request.files.length === 0) {
        return;
    }
    const fileAction = new FileAnyAction();
    fileAction.multiple(request.files);
}
