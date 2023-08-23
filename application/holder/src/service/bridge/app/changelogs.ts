import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { version } from '@module/version';
import { GitHubClient, IReleaseData } from '@module/github';
import { Version } from '@service/updater/version';
import { TARGET_TAG_STARTS, REPO } from '@service/updater';
import { error } from 'platform/log/utils';

import * as Requests from 'platform/ipc/request';

async function getReleaseInfo(
    version: string,
    log: Logger,
): Promise<{ release: IReleaseData; version: Version } | undefined> {
    const github = new GitHubClient();
    const releases: IReleaseData[] = await github.getReleases({ repo: REPO });
    const target: Version = new Version(version);
    let candidate: { release: IReleaseData; version: Version } | undefined;
    releases.forEach((release: IReleaseData) => {
        if (!release.name.toLowerCase().includes(TARGET_TAG_STARTS)) {
            return;
        }
        if (candidate !== undefined) {
            return;
        }
        try {
            const version = new Version(release.name, TARGET_TAG_STARTS);
            if (target.isGivenSame(version)) {
                candidate = {
                    release,
                    version,
                };
            }
        } catch (err) {
            log.warn(
                `Found release "${release.name} (tag: ${
                    release.tag_name
                })", but version isn't valid: ${error(err)}`,
            );
        }
    });
    return candidate;
}

export const handler = Requests.InjectLogger<
    Requests.App.Changelogs.Request,
    CancelablePromise<Requests.App.Changelogs.Response>
>(
    (
        log: Logger,
        request: Requests.App.Changelogs.Request,
    ): CancelablePromise<Requests.App.Changelogs.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            const ver = request.version === undefined ? version.getVersion() : request.version;
            getReleaseInfo(ver, log)
                .then((candidate) => {
                    resolve(
                        new Requests.App.Changelogs.Response({
                            markdown: candidate === undefined ? '' : candidate.release.body,
                            version: ver,
                            error: undefined,
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.App.Changelogs.Response({
                            markdown: ``,
                            version: ver,
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
