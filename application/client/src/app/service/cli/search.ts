import { CancelablePromise } from '@platform/env/promise';
import { Service } from '@service/cli';
import { session } from '@service/session';
import { StoredEntity } from '@service/session/dependencies/search/store';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';

import * as Requests from '@platform/ipc/request';

export function handler(
    cli: Service,
    request: Requests.Cli.Search.Request,
): CancelablePromise<Requests.Cli.Search.Response> {
    return new CancelablePromise(async (resolve, _reject) => {
        action(cli, request);
        resolve(new Requests.Cli.Search.Response({ error: undefined }));
    });
}
export function action(cli: Service, request: Requests.Cli.Search.Request): void {
    if (request.sessions.length === 0) {
        return;
    }
    const filters = request.filters.map((str) => {
        return FilterRequest.defaults(str);
    });
    request.sessions.forEach((uuid) => {
        const instance = session.get(uuid);
        if (instance === undefined) {
            cli.log().warn(`Cannot apply filter (via CLI): fail to find session: ${uuid}`);
            return;
        }
        instance.search
            .store()
            .filters()
            .overwrite(filters as StoredEntity<FilterRequest>[]);
    });
}
