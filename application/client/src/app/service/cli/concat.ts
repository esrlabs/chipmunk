import { opener } from '@service/opener';
import { action as open } from './open';
import { FileType, getFileTypeByExt } from '@platform/types/files';
import { CancelablePromise } from '@platform/env/promise';
import { Service } from '@service/cli';

import * as Requests from '@platform/ipc/request';

export function handler(
    cli: Service,
    request: Requests.Cli.Concat.Request,
): CancelablePromise<Requests.Cli.Concat.Response> {
    return new CancelablePromise(async (resolve, _reject) => {
        action(cli, request)
            .then((sessions: string[]) => {
                resolve(new Requests.Cli.Concat.Response({ sessions, error: undefined }));
            })
            .catch((err: Error) => {
                resolve(
                    new Requests.Cli.Concat.Response({ sessions: undefined, error: err.message }),
                );
            });
    });
}

export async function action(
    cli: Service,
    request: Requests.Cli.Concat.Request,
): Promise<string[]> {
    if (request.files.length === 0) {
        return [];
    }
    const sessions: string[] = [];
    if (request.files.length === 1) {
        return open(cli, new Requests.Cli.Concat.Request({ files: request.files })).catch(
            (err: Error) => {
                cli.log().warn(
                    `Fail to apply action (Events.Cli.Concat.Event with redirection to Events.Cli.Open.Event): ${err.message}`,
                );
                return [];
            },
        );
    }
    const groups: { [key: string]: string[] } = {
        dlt: [],
        pcap: [],
        any: [],
    };
    request.files.forEach((file) => {
        switch (getFileTypeByExt(file)) {
            case FileType.Dlt:
                groups['dlt'].push(file);
                break;
            case FileType.Pcap:
                groups['pcap'].push(file);
                break;
            case FileType.Any:
            default:
                groups['any'].push(file);
        }
    });
    for (const group of Object.keys(groups)) {
        const files = groups[group];
        if (files.length === 0) {
            continue;
        }
        const executor: () => Promise<string> = (() => {
            if (group === 'dlt') {
                return opener.concat(files).dlt;
            } else if (group === 'pcap') {
                throw new Error(`Not implemented PCAP support`);
            } else {
                return opener.concat(files).text;
            }
        })();
        const session = await executor().catch((err: Error) => {
            cli.log().warn(`Fail to apply action (Events.Cli.Open.Event): ${err.message}`);
            return undefined;
        });
        session !== undefined && sessions.push(session);
    }
    return sessions;
}
