import { opener } from '@service/opener';
import { CancelablePromise } from '@platform/env/promise';
import { Service } from '@service/cli';
import { ParserName } from '@platform/types/observe';
import { session as sessions } from '@service/session';
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

function getSettings(full: string, cwd: string): ProcessTransportSettings {
    const args = full.split(' ');
    const command = args.shift() as string;
    return {
        command,
        args,
        cwd,
        envs: {},
    };
}
export async function action(
    cli: Service,
    request: Requests.Cli.Stdout.Request,
): Promise<string[]> {
    const first = request.commands.shift();
    if (first === undefined) {
        return [];
    }
    let uuid: string | undefined;
    const source = {
        process: getSettings(first, request.cwd),
    };
    switch (request.parser) {
        case ParserName.Dlt:
            uuid = await opener
                .stream(source, false)
                .dlt({
                    logLevel: 0,
                    filters: {},
                    fibex: [],
                })
                .catch((err: Error) => {
                    cli.log().warn(
                        `Fail to apply action (Events.Cli.Stdout.Event): ${err.message}`,
                    );
                    return undefined;
                });
            break;
        case ParserName.Pcap:
        case ParserName.Someip:
            throw new Error(`Pcap / SomeIp isn't supported for streaming.`);
        case ParserName.Text:
        default:
            uuid = await opener
                .stream(source, false)
                .text({})
                .catch((err: Error) => {
                    cli.log().warn(
                        `Fail to apply action (Events.Cli.Stdout.Event): ${err.message}`,
                    );
                    return undefined;
                });
    }
    if (uuid === undefined) {
        throw new Error(`Fail to create base session.`);
    }
    const session = sessions.get(uuid);
    if (session === undefined) {
        throw new Error(`Fail to find created base session.`);
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
