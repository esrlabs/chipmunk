import { net, NetworkError } from '@module/net';
import { Request as Base } from '../request';
import { GitHubRepo } from 'platform/types/github';
import { error } from 'platform/log/utils';
import { Queue } from '../queue';

import * as validator from 'platform/env/obj';

export interface CommitObject {
    sha: string;
    login: string;
}

export class Request extends Base<CommitObject> {
    constructor(queue: Queue, options: GitHubRepo, protected readonly filename: string) {
        super(queue, options);
    }

    public executor(): Promise<CommitObject> {
        return new Promise((resolve, reject) => {
            net.getRaw(
                `https://api.github.com/repos/${this.options.owner}/${this.options.repo}/commits?path=${this.filename}&per_page=1`,
                this.getHeaders(),
            )
                .then((raw: string) => {
                    try {
                        const response: { sha: string; author: { login: string } }[] =
                            JSON.parse(raw);
                        if (!(response instanceof Array)) {
                            throw new Error(`Expecting an array of commits data`);
                        }
                        if (response.length === 0) {
                            throw new Error(`No commits related to file`);
                        }
                        validator.getAsObj(response[0], 'author');
                        resolve({
                            sha: validator.getAsNotEmptyString(response[0], 'sha'),
                            login: validator.getAsNotEmptyString(response[0].author, 'login'),
                        });
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

// https://docs.github.com/en/rest/git/commits?apiVersion=2022-11-28#get-a-commit-object
// curl -L \
//   -H "Accept: application/vnd.github+json" \
//   -H "Authorization: Bearer <YOUR-TOKEN>" \
//   -H "X-GitHub-Api-Version: 2022-11-28" \
//   https://api.github.com/repos/OWNER/REPO/git/commits/COMMIT_SHA
//   {
//     "sha": "7638417db6d59f3c431d3e1f261cc637155684cd",
//     "node_id": "MDY6Q29tbWl0NmRjYjA5YjViNTc4NzVmMzM0ZjYxYWViZWQ2OTVlMmU0MTkzZGI1ZQ==",
//     "url": "https://api.github.com/repos/octocat/Hello-World/git/commits/7638417db6d59f3c431d3e1f261cc637155684cd",
//     "html_url": "https://github.com/octocat/Hello-World/commit/7638417db6d59f3c431d3e1f261cc637155684cd",
//     "author": {
//       "date": "2014-11-07T22:01:45Z",
//       "name": "Monalisa Octocat",
//       "email": "octocat@github.com"
//     },
//     "committer": {
//       "date": "2014-11-07T22:01:45Z",
//       "name": "Monalisa Octocat",
//       "email": "octocat@github.com"
//     },
//     "message": "added readme, because im a good github citizen",
//     "tree": {
//       "url": "https://api.github.com/repos/octocat/Hello-World/git/trees/691272480426f78a0138979dd3ce63b77f706feb",
//       "sha": "691272480426f78a0138979dd3ce63b77f706feb"
//     },
//     "parents": [
//       {
//         "url": "https://api.github.com/repos/octocat/Hello-World/git/commits/1acc419d4d6a9ce985db7be48c6349a0475975b5",
//         "sha": "1acc419d4d6a9ce985db7be48c6349a0475975b5",
//         "html_url": "https://github.com/octocat/Hello-World/commit/7638417db6d59f3c431d3e1f261cc637155684cd"
//       }
//     ],
//     "verification": {
//       "verified": false,
//       "reason": "unsigned",
//       "signature": null,
//       "payload": null
//     }
//   }
