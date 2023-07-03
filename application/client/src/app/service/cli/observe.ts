import { CancelablePromise } from '@platform/env/promise';
import { Service } from '@service/cli';
import { session } from '@service/session';
import { Observe } from '@platform/types/observe';

import * as Requests from '@platform/ipc/request';

export function handler(
    cli: Service,
    request: Requests.Cli.Observe.Request,
): CancelablePromise<Requests.Cli.Observe.Response> {
    return new CancelablePromise(async (resolve, _reject) => {
        action(cli, request)
            .then((session: string | undefined) => {
                resolve(new Requests.Cli.Observe.Response({ session, error: undefined }));
            })
            .catch((err: Error) => {
                resolve(
                    new Requests.Cli.Observe.Response({ session: undefined, error: err.message }),
                );
            });
    });
}
export async function action(
    cli: Service,
    request: Requests.Cli.Observe.Request,
): Promise<string | undefined> {
    return session
        .initialize()
        .auto(new Observe(request.observe).locker().guess())
        .catch((err: Error) => {
            cli.log().warn(`Fail to apply action (Events.Cli.Observe.Event): ${err.message}`);
            return undefined;
        });
}
