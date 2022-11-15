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
import { Session, session } from '@service/session';
import { ParserName } from '@platform/types/observe';
import { getRenderFor } from '@schema/render/tools';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';
import * as handlers from './cli/index';

@DependOn(api)
@SetupService(services['cli'])
export class Service extends Implementation {
    // Bound with stream session
    protected streams: Map<ParserName, Session> = new Map();

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
        this.register(
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Cli.Stdout.Request,
                    (
                        request: Requests.Cli.Stdout.Request,
                    ): CancelablePromise<Requests.Cli.Stdout.Response> => {
                        return handlers.stdout(this, request);
                    },
                ),
        );
        this.register(
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Cli.Serial.Request,
                    (
                        request: Requests.Cli.Serial.Request,
                    ): CancelablePromise<Requests.Cli.Serial.Response> => {
                        return handlers.serial(this, request);
                    },
                ),
        );
        this.register(
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Cli.Tcp.Request,
                    (
                        request: Requests.Cli.Tcp.Request,
                    ): CancelablePromise<Requests.Cli.Tcp.Response> => {
                        return handlers.tcp(this, request);
                    },
                ),
        );
        this.register(
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Cli.Udp.Request,
                    (
                        request: Requests.Cli.Udp.Request,
                    ): CancelablePromise<Requests.Cli.Udp.Response> => {
                        return handlers.udp(this, request);
                    },
                ),
        );
        Events.IpcEvent.subscribe(Events.Cli.Done.Event, (_event: Events.Cli.Done.Event) => {
            this.streams.clear();
        });
        return Promise.resolve();
    }

    public state(): {
        stream(parser: ParserName): Promise<Session>;
    } {
        return {
            stream: async (parser: ParserName): Promise<Session> => {
                let stream = this.streams.get(parser);
                if (stream !== undefined) {
                    return stream;
                }
                stream = await session
                    .add()
                    .empty(
                        parser === ParserName.Dlt
                            ? getRenderFor().dlt()
                            : parser === ParserName.Pcap
                            ? getRenderFor().pcap()
                            : getRenderFor().text(),
                    );
                this.streams.set(parser, stream);
                return stream;
            },
        };
    }
}
export interface Service extends Interface {}
export const cli = register(new Service());
