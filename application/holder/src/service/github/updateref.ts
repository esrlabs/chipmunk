import { net, NetworkError } from '@module/net';
import { Request as Base } from './request';
import { GitHubRepo } from 'platform/types/github';
import { error } from 'platform/log/utils';

import * as validator from 'platform/env/obj';

export interface Update {
    sha: string;
    force: boolean;
}

export class Request extends Base<string> {
    constructor(options: GitHubRepo, protected readonly update: Update) {
        super(options);
    }

    public send(): Promise<string> {
        return new Promise((resolve, reject) => {
            net.post(
                `https://api.github.com/repos/${this.options.owner}/${this.options.repo}/git/refs/${this.options.branch}`,
                this.getHeaders(),
                JSON.stringify(this.update),
                'PATCH',
            )
                .then((raw: string) => {
                    try {
                        const response = JSON.parse(raw);
                        validator.isObject(response);
                        validator.getAsNotEmptyString(response, 'sha');
                        validator.getAsObj(response, 'object');
                        validator.getAsNotEmptyString(response.object, 'sha');
                        resolve(response.object.sha);
                    } catch (err) {
                        reject(new Error(`Parsing error: ${error(err)}`));
                    }
                })
                .catch((err: NetworkError) => {
                    reject(new Error(`Network error (code ${err.code}): ${err.message}`));
                });
        });
    }
}

// https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28#update-a-reference
// curl -L \
//   -X PATCH \
//   -H "Accept: application/vnd.github+json" \
//   -H "Authorization: Bearer <YOUR-TOKEN>" \
//   -H "X-GitHub-Api-Version: 2022-11-28" \
//   https://api.github.com/repos/OWNER/REPO/git/refs/REF \
//   -d '{"sha":"aa218f56b14c9653891f9e74264a383fa43fefbd","force":true}'
//
// {
//     "ref": "refs/heads/featureA",
//     "node_id": "MDM6UmVmcmVmcy9oZWFkcy9mZWF0dXJlQQ==",
//     "url": "https://api.github.com/repos/octocat/Hello-World/git/refs/heads/featureA",
//     "object": {
//       "type": "commit",
//       "sha": "aa218f56b14c9653891f9e74264a383fa43fefbd",
//       "url": "https://api.github.com/repos/octocat/Hello-World/git/commits/aa218f56b14c9653891f9e74264a383fa43fefbd"
//     }
//   }
