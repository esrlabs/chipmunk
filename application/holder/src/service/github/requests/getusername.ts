import { net, NetworkError } from '@module/net';
import { Request as Base } from '../request';
import { GitHubRepo } from 'platform/types/github';
import { error } from 'platform/log/utils';
import { Queue } from '../queue';

import * as validator from 'platform/env/obj';

export class Request extends Base<string> {
    constructor(queue: Queue, options: GitHubRepo) {
        super(queue, options);
    }

    public executor(): Promise<string> {
        return new Promise((resolve, reject) => {
            net.getRaw(`https://api.github.com/user`, this.getHeaders())
                .then((raw: string) => {
                    try {
                        const response = JSON.parse(raw);
                        validator.isObject(response);
                        const login = validator.getAsNotEmptyString(response, 'login');
                        resolve(login);
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

// https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28#update-the-authenticated-user
// curl -L \
//   -H "Accept: application/vnd.github+json" \
//   -H "Authorization: Bearer <YOUR-TOKEN>" \
//   -H "X-GitHub-Api-Version: 2022-11-28" \
//   https://api.github.com/user
// {
//     "login": "octocat",
//     "id": 1,
//     "node_id": "MDQ6VXNlcjE=",
//     "avatar_url": "https://github.com/images/error/octocat_happy.gif",
//     "gravatar_id": "",
//     "url": "https://api.github.com/users/octocat",
//     "html_url": "https://github.com/octocat",
//     "followers_url": "https://api.github.com/users/octocat/followers",
//     "following_url": "https://api.github.com/users/octocat/following{/other_user}",
//     "gists_url": "https://api.github.com/users/octocat/gists{/gist_id}",
//     "starred_url": "https://api.github.com/users/octocat/starred{/owner}{/repo}",
//     "subscriptions_url": "https://api.github.com/users/octocat/subscriptions",
//     "organizations_url": "https://api.github.com/users/octocat/orgs",
//     "repos_url": "https://api.github.com/users/octocat/repos",
//     "events_url": "https://api.github.com/users/octocat/events{/privacy}",
//     "received_events_url": "https://api.github.com/users/octocat/received_events",
//     "type": "User",
//     "site_admin": false,
//     "name": "monalisa octocat",
//     "company": "GitHub",
//     "blog": "https://github.com/blog",
//     "location": "San Francisco",
//     "email": "octocat@github.com",
//     "hireable": false,
//     "bio": "There once was...",
//     "twitter_username": "monatheoctocat",
//     "public_repos": 2,
//     "public_gists": 1,
//     "followers": 20,
//     "following": 0,
//     "created_at": "2008-01-14T04:33:35Z",
//     "updated_at": "2008-01-14T04:33:35Z",
//     "private_gists": 81,
//     "total_private_repos": 100,
//     "owned_private_repos": 100,
//     "disk_usage": 10000,
//     "collaborators": 8,
//     "two_factor_authentication": true,
//     "plan": {
//       "name": "Medium",
//       "space": 400,
//       "private_repos": 20,
//       "collaborators": 0
//     }
//   }
