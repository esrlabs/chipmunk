import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Session.McpPrompt.Request,
    CancelablePromise<Requests.Session.McpPrompt.Response>
>(
    (
        log: Logger,
        request: Requests.Session.McpPrompt.Request,
    ): CancelablePromise<Requests.Session.McpPrompt.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .sendMcpPrompt(request.prompt)
                .then(() => {
                    resolve(
                        new Requests.Session.McpPrompt.Response({
                            session: stored.session.getUUID(),
                        }),
                    );
                })
                .catch((err: Error) => {
                    log.error(`Fail to send MCP prompt: ${err.message}`);
                    reject(err);
                });
        });
    },
);
