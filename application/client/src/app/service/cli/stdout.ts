import { CancelablePromise } from '@platform/env/promise';
import { Service } from '@service/cli';
import { ParserName } from '@platform/types/observe';
import { ProcessTransportSettings } from '@platform/types/transport/process';

import * as Requests from '@platform/ipc/request';

export function handler(
    cli: Service,
    request: Requests.Cli.Stdout.Request,
): CancelablePromise<Requests.Cli.Stdout.Response> {
    return new CancelablePromise(async (resolve, _reject) => {
        action(cli, request)
            .then((sessions: string[]) => {
                resolve(new Requests.Cli.Stdout.Response({ sessions, error: undefined }));
            })
            .catch((err: Error) => {
                resolve(
                    new Requests.Cli.Stdout.Response({ sessions: undefined, error: err.message }),
                );
            });
    });
}

function getSettings(command: string, cwd: string): ProcessTransportSettings {
    return {
        command,
        cwd,
        envs: {},
    };
}
export async function action(
    cli: Service,
    request: Requests.Cli.Stdout.Request,
): Promise<string[]> {
    if (request.commands.length === 0) {
        return [];
    }
    const session = await cli.state().stream(request.parser);
    if (session === undefined) {
        throw new Error(`Fail to create/get base session.`);
    }
    for (const command of request.commands) {
        const connector = session.stream.connect({
            process: getSettings(command, request.cwd),
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
    }
    return [session.uuid()];
}
