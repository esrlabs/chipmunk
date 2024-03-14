import { net, NetworkError } from '@module/net';
import { Request as Base } from '../request';
import { GitHubRepo } from 'platform/types/github';
import { error } from 'platform/log/utils';
import { Queue } from 'platform/env/runner';

import * as validator from 'platform/env/obj';

export interface TreeElement {
    path: string;
    mode: '100644' | '100755' | '040000' | '160000' | '120000';
    type: 'blob' | 'tree' | 'commit';
    sha?: string;
    content: string;
}

export class Request extends Base<string> {
    constructor(
        queue: Queue,
        options: GitHubRepo,
        protected readonly baseTreeSha: string,
        protected tree: TreeElement,
    ) {
        super(queue, options);
    }

    public executor(): Promise<string> {
        return new Promise((resolve, reject) => {
            net.post(
                `https://api.github.com/repos/${this.options.owner}/${this.options.repo}/git/trees`,
                this.getHeaders(),
                JSON.stringify({
                    base_tree: this.baseTreeSha,
                    tree: [this.tree],
                }),
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
                    reject(new Error(`Network error: ${err.message}`));
                });
        });
    }
}

// https://docs.github.com/en/rest/git/trees?apiVersion=2022-11-28#create-a-tree
// curl -L \
//   -X POST \
//   -H "Accept: application/vnd.github+json" \
//   -H "Authorization: Bearer <YOUR-TOKEN>" \
//   -H "X-GitHub-Api-Version: 2022-11-28" \
//   https://api.github.com/repos/OWNER/REPO/git/trees \
//   -d '{"base_tree":"9fb037999f264ba9a7fc6274d15fa3ae2ab98312","tree":[{"path":"file.rb","mode":"100644","type":"blob","sha":"44b4fc6d56897b048c772eb4087f854f46256132"}]}'
// {
//     "sha": "cd8274d15fa3ae2ab983129fb037999f264ba9a7",
//     "url": "https://api.github.com/repos/octocat/Hello-World/trees/cd8274d15fa3ae2ab983129fb037999f264ba9a7",
//     "tree": [
//       {
//         "path": "file.rb",
//         "mode": "100644",
//         "type": "blob",
//         "size": 132,
//         "sha": "7c258a9869f33c1e1e1f74fbb32f07c86cb5a75b",
//         "url": "https://api.github.com/repos/octocat/Hello-World/git/blobs/7c258a9869f33c1e1e1f74fbb32f07c86cb5a75b"
//       }
//     ],
//     "truncated": true
//   }
