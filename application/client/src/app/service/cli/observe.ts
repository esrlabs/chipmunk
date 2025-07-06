import { CancelablePromise } from '@platform/env/promise';
import { Service } from '@service/cli';
import { session } from '@service/session';

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
    if (request.observe.length === 0) {
        return Promise.resolve(undefined);
    }
    let uuid: string | undefined = undefined;
    for (const observe of request.observe) {
        console.error(`Not implemented`);
        return Promise.reject(new Error(`Not implemented`));
        // if (uuid === undefined) {
        //     uuid = await session
        //         .initialize()
        //         .auto(new Observe(observe).locker().guess())
        //         .catch((err: Error) => {
        //             cli.log().warn(
        //                 `Fail to apply action (Events.Cli.Observe.Event): ${err.message}`,
        //             );
        //             return undefined;
        //         });
        //     if (uuid === undefined) {
        //         return Promise.resolve(undefined);
        //     }
        // } else {
        //     const instance = session.get(uuid);
        //     if (instance === undefined) {
        //         return Promise.resolve(undefined);
        //     }
        //     await session
        //         .initialize()
        //         .auto(new Observe(observe).locker().guess(), instance)
        //         .catch((err: Error) => {
        //             cli.log().warn(
        //                 `Fail to apply action (Events.Cli.Observe.Event): ${err.message}`,
        //             );
        //             return undefined;
        //         });
        // }
    }
    return Promise.resolve(uuid);
}
