import { opener } from '@service/opener';
import { FileType, getFileTypeByExt } from '@platform/types/files';
import { CancelablePromise } from '@platform/env/promise';
import { Service } from '@service/cli';

import * as Requests from '@platform/ipc/request';

export function handler(
    cli: Service,
    request: Requests.Cli.Open.Request,
): CancelablePromise<Requests.Cli.Open.Response> {
    return new CancelablePromise(async (resolve, _reject) => {
        action(cli, request)
            .then((sessions: string[]) => {
                resolve(new Requests.Cli.Open.Response({ sessions, error: undefined }));
            })
            .catch((err: Error) => {
                resolve(
                    new Requests.Cli.Open.Response({ sessions: undefined, error: err.message }),
                );
            });
    });
}
export async function action(cli: Service, request: Requests.Cli.Open.Request): Promise<string[]> {
    if (request.files.length === 0) {
        return [];
    }
    const sessions: string[] = [];
    for (const file of request.files) {
        let session: string | undefined;
        switch (getFileTypeByExt(file)) {
            case FileType.Dlt:
                session = await opener
                    .file(file)
                    .dlt()
                    .catch((err: Error) => {
                        cli.log().warn(
                            `Fail to apply action (Events.Cli.Open.Event): ${err.message}`,
                        );
                        return undefined;
                    });
                break;
            case FileType.Pcap:
                // TODO: add pcap support
                // await opener
                //     .file(file)
                //     .pcap()
                //     .catch((err: Error) => {
                //         logger.warn(`Fail to apply action (Events.Cli.Open.Event): ${err.message}`);
                //     });
                break;
            case FileType.Any:
            default:
                session = await opener
                    .file(file)
                    .text()
                    .catch((err: Error) => {
                        cli.log().warn(
                            `Fail to apply action (Events.Cli.Open.Event): ${err.message}`,
                        );
                        return undefined;
                    });
        }
        session !== undefined && sessions.push(session);
    }
    return sessions;
}
