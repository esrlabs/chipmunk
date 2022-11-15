import { CancelablePromise } from '@platform/env/promise';
import { Service } from '@service/cli';
import { ParserName } from '@platform/types/observe';

import * as Requests from '@platform/ipc/request';

export function handler(
    cli: Service,
    request: Requests.Cli.Tcp.Request,
): CancelablePromise<Requests.Cli.Tcp.Response> {
    return new CancelablePromise(async (resolve, _reject) => {
        action(cli, request)
            .then((sessions: string[]) => {
                resolve(new Requests.Cli.Tcp.Response({ sessions, error: undefined }));
            })
            .catch((err: Error) => {
                resolve(
                    new Requests.Cli.Tcp.Response({ sessions: undefined, error: err.message }),
                );
            });
    });
}

export async function action(
    cli: Service,
    request: Requests.Cli.Tcp.Request,
): Promise<string[]> {
    const session = await cli.state().stream(request.parser);
    if (session === undefined) {
        throw new Error(`Fail to create/get base session.`);
    }
    const connector = session.stream.connect({
        tcp: request.source,
    });
    switch (request.parser) {
        case ParserName.Dlt:
            await connector.dlt({
                logLevel: 0,
                filters: {},
                fibex: [],
            });
            break;
        case ParserName.Text:
        default:
            await connector.text();
    }
    return [session.uuid()];
}
