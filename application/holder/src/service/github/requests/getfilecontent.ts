import { net, NetworkError } from '@module/net';
import { Request as Base } from '../request';
import { GitHubRepo } from 'platform/types/github';
import { error } from 'platform/log/utils';
import { Queue } from '../queue';

import * as validator from 'platform/env/obj';

const RESOURCE_NOT_FOUND = 404;
const BASE64_ENCODING = 'base64';

export interface FileObject {
    type: string;
    encoding: string;
    size: number;
    name: string;
    path: string;
    content: string;
    sha: string;
}

export class Request extends Base<FileObject | undefined> {
    constructor(queue: Queue, options: GitHubRepo, protected readonly path: string) {
        super(queue, options);
    }

    public executor(): Promise<FileObject | undefined> {
        return new Promise((resolve, reject) => {
            net.getRaw(
                `https://api.github.com/repos/${this.options.owner}/${this.options.repo}/contents/${this.path}`,
                this.getHeaders(),
            )
                .then((raw: string) => {
                    try {
                        const response = JSON.parse(raw);
                        validator.isObject(response);
                        validator.getAsNotEmptyString(response, 'type');
                        validator.getAsNotEmptyString(response, 'encoding');
                        validator.getAsNotEmptyString(response, 'name');
                        validator.getAsNotEmptyString(response, 'path');
                        validator.getAsNotEmptyString(response, 'content');
                        validator.getAsNotEmptyString(response, 'sha');
                        validator.getAsValidNumber(response, 'size');
                        if (response.encoding === BASE64_ENCODING) {
                            response.content = Buffer.from(response.content, 'base64').toString(
                                'utf-8',
                            );
                        }
                        resolve(response);
                    } catch (err) {
                        reject(new Error(`Parsing error: ${error(err)}`));
                    }
                })
                .catch((err: NetworkError) => {
                    if (err.code === RESOURCE_NOT_FOUND) {
                        resolve(undefined);
                    } else {
                        reject(new Error(`Network error: ${err.message}`));
                    }
                });
        });
    }
}

// https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28
// curl -L \
//   -H "Accept: application/vnd.github+json" \
//   -H "Authorization: Bearer <YOUR-TOKEN>" \
//   -H "X-GitHub-Api-Version: 2022-11-28" \
//   https://api.github.com/repos/OWNER/REPO/contents/PATH
// {
//     "type": "file",
//     "encoding": "base64",
//     "size": 5362,
//     "name": "README.md",
//     "path": "README.md",
//     "content": "IyBZb2dhIEJvmsgaW4gcHJvZ3Jlc3MhIEZlZWwgdAoKOndhcm5pbmc6IFdvc\\nZnJlZSBmUgdG8gY0byBjaGVjayBvdXQgdGhlIGFwcCwgYnV0IGJlIHN1c29t\\nZSBiYWNrIG9uY2UgaXQgaXMgY29tcGxldGUuCgpBIHdlYiBhcHAgdGhhdCBs\\nZWFkcyB5b3UgdGhyb3VnaCBhIHlvZ2Egc2Vzc2lvbi4KCltXb3Jrb3V0IG5v\\ndyFdKGh0dHBzOi8vc2tlZHdhcmRzODguZ2l0aHViLmlvL3lvZ2EvKQoKPGlt\\nZyBzcmM9InNyYy9pbWFnZXMvbWFza2FibGVfaWNvbl81MTIucG5nIiBhbHQ9\\nImJvdCBsaWZ0aW5nIHdlaWdodHMiIHdpZHRoPSIxMDAiLz4KCkRvIHlvdSBo\\nYXZlIGZlZWRiYWNrIG9yIGlkZWFzIGZvciBpbXByb3ZlbWVudD8gW09wZW4g\\nYW4gaXNzdWVdKGh0dHBzOi8vZ2l0aHViLmNvbS9za2Vkd2FyZHM4OC95b2dh\\nL2lzc3Vlcy9uZXcpLgoKV2FudCBtb3JlIGdhbWVzPyBWaXNpdCBbQ25TIEdh\\nbWVzXShodHRwczovL3NrZWR3YXJkczg4LmdpdGh1Yi5pby9wb3J0Zm9saW8v\\nKS4KCiMjIERldmVsb3BtZW50CgpUbyBhZGQgYSBuZXcgcG9zZSwgYWRkIGFu\\nIGVudHJ5IHRvIHRoZSByZWxldmFudCBmaWxlIGluIGBzcmMvYXNhbmFzYC4K\\nClRvIGJ1aWxkLCBydW4gYG5wbSBydW4gYnVpbGRgLgoKVG8gcnVuIGxvY2Fs\\nbHkgd2l0aCBsaXZlIHJlbG9hZGluZyBhbmQgbm8gc2VydmljZSB3b3JrZXIs\\nIHJ1biBgbnBtIHJ1biBkZXZgLiAoSWYgYSBzZXJ2aWNlIHdvcmtlciB3YXMg\\ncHJldmlvdXNseSByZWdpc3RlcmVkLCB5b3UgY2FuIHVucmVnaXN0ZXIgaXQg\\naW4gY2hyb21lIGRldmVsb3BlciB0b29sczogYEFwcGxpY2F0aW9uYCA+IGBT\\nZXJ2aWNlIHdvcmtlcnNgID4gYFVucmVnaXN0ZXJgLikKClRvIHJ1biBsb2Nh\\nbGx5IGFuZCByZWdpc3RlciB0aGUgc2VydmljZSB3b3JrZXIsIHJ1biBgbnBt\\nIHN0YXJ0YC4KClRvIGRlcGxveSwgcHVzaCB0byBgbWFpbmAgb3IgbWFudWFs\\nbHkgdHJpZ2dlciB0aGUgYC5naXRodWIvd29ya2Zsb3dzL2RlcGxveS55bWxg\\nIHdvcmtmbG93Lgo=\\n",
//     "sha": "3d21ec53a331a6f037a91c368710b99387d012c1",
//     "url": "https://api.github.com/repos/octokit/octokit.rb/contents/README.md",
//     "git_url": "https://api.github.com/repos/octokit/octokit.rb/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1",
//     "html_url": "https://github.com/octokit/octokit.rb/blob/master/README.md",
//     "download_url": "https://raw.githubusercontent.com/octokit/octokit.rb/master/README.md",
//     "_links": {
//       "git": "https://api.github.com/repos/octokit/octokit.rb/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1",
//       "self": "https://api.github.com/repos/octokit/octokit.rb/contents/README.md",
//       "html": "https://github.com/octokit/octokit.rb/blob/master/README.md"
//     }
//   }
