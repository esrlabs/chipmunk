import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Observe.SourcesDefinitionsList.Request,
    CancelablePromise<Requests.Observe.SourcesDefinitionsList.Response>
>(
    (
        log: Logger,
        request: Requests.Observe.SourcesDefinitionsList.Request,
    ): CancelablePromise<Requests.Observe.SourcesDefinitionsList.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getStream()
                .getSourcesDefinitions()
                .then((sources) => {
                    resolve(
                        new Requests.Observe.SourcesDefinitionsList.Response({
                            session: stored.session.getUUID(),
                            sources,
                        }),
                    );
                })
                .catch(reject);
        });
    },
);
