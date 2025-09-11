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
import * as Events from '@platform/ipc/event';
import * as handlers from './cli/index';

@DependOn(api)
@SetupService(services['cli'])
export class Service extends Implementation {
    protected filters: Set<string> = new Set();

    public isFiltersImported(uuid: string): boolean {
        return this.filters.has(uuid);
    }
    public override init(): Promise<void> {
        this.register(
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Cli.Observe.Request,
                    (
                        request: Requests.Cli.Observe.Request,
                    ): CancelablePromise<Requests.Cli.Observe.Response> => {
                        return handlers.observe(this, request);
                    },
                ),
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Cli.Search.Request,
                    (
                        request: Requests.Cli.Search.Request,
                    ): CancelablePromise<Requests.Cli.Search.Response> => {
                        if (request.filters.length > 0) {
                            request.sessions.forEach((uuid: string) => this.filters.add(uuid));
                        }
                        return handlers.search(this, request);
                    },
                ),
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Cli.MultiFiles.Request,
                    (
                        request: Requests.Cli.MultiFiles.Request,
                    ): CancelablePromise<Requests.Cli.MultiFiles.Response> => {
                        return handlers.multiFiles(request);
                    },
                ),
        );
        Events.IpcEvent.subscribe(Events.Cli.Done.Event, (_event: Events.Cli.Done.Event) => {
            // TODO: not clear now (after refactoring) - what we should to do now?
            // Probably we should lock UI while CLI is processing and here we should
            // unlock UI
        });
        return Promise.resolve();
    }
    public getCommand(): Promise<string> {
        return Requests.IpcRequest.send(
            Requests.Cli.GetCommand.Response,
            new Requests.Cli.GetCommand.Request(),
        ).then((response: Requests.Cli.GetCommand.Response) => {
            return Promise.resolve(response.command);
        });
    }
}
export interface Service extends Interface {}
export const cli = register(new Service());
