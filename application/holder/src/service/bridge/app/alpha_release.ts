import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { GitHubClient } from '@module/github';
import { REPO } from '@service/updater';
import { getLatestAlphaRelease, getReleaseLabel } from '@service/updater/alpha';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.App.AlphaRelease.Request,
    CancelablePromise<Requests.App.AlphaRelease.Response>
>(
    (
        _log: Logger,
        _request: Requests.App.AlphaRelease.Request,
    ): CancelablePromise<Requests.App.AlphaRelease.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            const github = new GitHubClient();
            github
                .getReleases({ repo: REPO })
                .then((releases) => {
                    const alphaRelease = getLatestAlphaRelease(releases);
                    resolve(
                        new Requests.App.AlphaRelease.Response({
                            version:
                                alphaRelease === undefined
                                    ? undefined
                                    : getReleaseLabel(alphaRelease.release),
                            url:
                                alphaRelease === undefined
                                    ? undefined
                                    : alphaRelease.release.html_url,
                            error: undefined,
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.App.AlphaRelease.Response({
                            version: undefined,
                            url: undefined,
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
