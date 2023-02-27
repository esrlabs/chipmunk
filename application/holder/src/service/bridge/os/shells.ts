import { CancelablePromise } from 'platform/env/promise';
import { Instance as Logger } from 'platform/env/logger';
import { ShellProfile } from 'platform/types/shells';
import { shells } from 'rustcore';

import * as Requests from 'platform/ipc/request';

let cached: ShellProfile[] | undefined = undefined;

export const handler = Requests.InjectLogger<
	Requests.Os.Shells.Request,
	CancelablePromise<Requests.Os.Shells.Response>
>((_log: Logger, _request: Requests.Os.Shells.Request): CancelablePromise<Requests.Os.Shells.Response> => {
	return new CancelablePromise((resolve, reject) => {
		if (cached !== undefined) {
			resolve(new Requests.Os.Shells.Response({ profiles: cached }));
		} else {
			shells
				.getValidProfiles()
				.then((profiles) => {
                    cached = profiles;
					resolve(new Requests.Os.Shells.Response({ profiles }));
				})
				.catch(reject);
		}
	});
});
