import { net, NetworkError } from '@module/net';
import { Request as Base } from '../request';
import { GitHubRepo } from 'platform/types/github';
import { error } from 'platform/log/utils';
import { Queue } from '../queue';

import * as validator from 'platform/env/obj';

export interface Commit {
    message: string;
    author?: {
        name: string;
        email: string;
        date: string;
    };
    parents: string[];
    tree: string;
    signature?: string;
}

export class Request extends Base<string> {
    constructor(queue: Queue, options: GitHubRepo, protected readonly commit: Commit) {
        super(queue, options);
    }

    public executor(): Promise<string> {
        return new Promise((resolve, reject) => {
            net.post(
                `https://api.github.com/repos/${this.options.owner}/${this.options.repo}/git/commits`,
                this.getHeaders(),
                JSON.stringify(this.commit),
            )
                .then((raw: string) => {
                    try {
                        const response = JSON.parse(raw);
                        validator.getAsNotEmptyString(response, 'sha');
                        resolve(response.sha as string);
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
//   -X POST \
//   -H "Accept: application/vnd.github+json" \
//   -H "Authorization: Bearer <YOUR-TOKEN>" \
//   -H "X-GitHub-Api-Version: 2022-11-28" \
//   https://api.github.com/repos/OWNER/REPO/git/commits \
//   -d '{"message":"my commit message","author":{"name":"Mona Octocat","email":"octocat@github.com",
//        "date":"2008-07-09T16:13:30+12:00"},"parents":["7d1b31e74ee336d15cbd21741bc88a537ed063a0"],
//        "tree":"827efc6d56897b048c772eb4087f854f46256132","signature":"-----BEGIN PGP SIGNATURE-----...-----END PGP SIGNATURE-----\n"}'
//
// {
//     "sha": "7638417db6d59f3c431d3e1f261cc637155684cd",
//     "node_id": "MDY6Q29tbWl0NzYzODQxN2RiNmQ1OWYzYzQzMWQzZTFmMjYxY2M2MzcxNTU2ODRjZA==",
//     "url": "https://api.github.com/repos/octocat/Hello-World/git/commits/7638417db6d59f3c431d3e1f261cc637155684cd",
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
//     "message": "my commit message",
//     "tree": {
//       "url": "https://api.github.com/repos/octocat/Hello-World/git/trees/827efc6d56897b048c772eb4087f854f46256132",
//       "sha": "827efc6d56897b048c772eb4087f854f46256132"
//     },
//     "parents": [
//       {
//         "url": "https://api.github.com/repos/octocat/Hello-World/git/commits/7d1b31e74ee336d15cbd21741bc88a537ed063a0",
//         "sha": "7d1b31e74ee336d15cbd21741bc88a537ed063a0",
//         "html_url": "https://github.com/octocat/Hello-World/commit/7d1b31e74ee336d15cbd21741bc88a537ed063a0"
//       }
//     ],
//     "verification": {
//       "verified": false,
//       "reason": "unsigned",
//       "signature": null,
//       "payload": null
//     },
//     "html_url": "https://github.com/octocat/Hello-World/commit/7638417db6d59f3c431d3e1f261cc637155684cd"
//   }
