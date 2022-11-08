import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from '@platform/entity/service';
import { services } from '@register/services';
import { api } from '@service/api';
import { CancelablePromise } from '@platform/env/promise';

import * as Requests from '@platform/ipc/request';
import * as handlers from './cli/index';

@DependOn(api)
@SetupService(services['cli'])
export class Service extends Implementation {
    public override init(): Promise<void> {
        this.register(
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Cli.Open.Request,
                    (
                        request: Requests.Cli.Open.Request,
                    ): CancelablePromise<Requests.Cli.Open.Response> => {
                        return handlers.open(this, request);
                    },
                ),
        );
        this.register(
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Cli.Concat.Request,
                    (
                        request: Requests.Cli.Concat.Request,
                    ): CancelablePromise<Requests.Cli.Concat.Response> => {
                        return handlers.concat(this, request);
                    },
                ),
        );
        this.register(
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Cli.Search.Request,
                    (
                        request: Requests.Cli.Search.Request,
                    ): CancelablePromise<Requests.Cli.Search.Response> => {
                        return handlers.search(this, request);
                    },
                ),
        );
        return Promise.resolve();
    }
}
export interface Service extends Interface {}
export const cli = register(new Service());
