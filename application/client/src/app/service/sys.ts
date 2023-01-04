import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { api } from '@service/api';
import { session } from '@service/session';
import { CancelablePromise } from '@platform/env/promise';
import { unique } from '@platform/env/sequence';
import { system } from '@platform/modules/system';

import * as Requests from '@platform/ipc/request/index';

type Handler = () => void;

@SetupService(services['sys'])
export class Service extends Implementation {
    protected readonly jobs: Map<string, CancelablePromise<void>> = new Map();
    protected readonly state: {
        requested: number;
        forced: boolean;
        done: Handler | undefined;
        finished: boolean;
    } = {
        requested: -1,
        forced: false,
        done: undefined,
        finished: false,
    };

    public override ready(): Promise<void> {
        this.register(
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.System.Shutdown.Request,
                    (
                        request: Requests.System.Shutdown.Request,
                    ): CancelablePromise<Requests.System.Shutdown.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            if (this.state.done !== undefined) {
                                this.log().error(`Shutdown was already requestd.`);
                                return resolve(
                                    new Requests.System.Shutdown.Response({
                                        state: Requests.System.Shutdown.State.InProgress,
                                    }),
                                );
                            }
                            this.state.requested = Date.now();
                            this.state.forced = request.force;
                            this.state.done = () => {
                                this.state.finished = true;
                                session
                                    .closeAllSessions()
                                    .catch((err: Error) => {
                                        this.log().error(
                                            `Fail to close all session: ${err.message}`,
                                        );
                                    })
                                    .finally(() => {
                                        this.log().debug(`Shutdowning services`);
                                        system
                                            .destroy()
                                            .then(() => {
                                                this.log().debug(
                                                    `All services are down. Client can be closed`,
                                                );
                                            })
                                            .catch((err: Error) => {
                                                this.log().error(
                                                    `Fail to shutdown all service: ${err.message}`,
                                                );
                                            })
                                            .finally(() => {
                                                resolve(
                                                    new Requests.System.Shutdown.Response({
                                                        state: Requests.System.Shutdown.State.Ready,
                                                    }),
                                                );
                                            });
                                    });
                            };
                            this.shutdown().init();
                        });
                    },
                ),
        );
        return Promise.resolve();
    }

    public job(): {
        add(job: CancelablePromise<void>): string;
        remove(uuid: string): void;
    } {
        return {
            add: (job: CancelablePromise<void>): string => {
                const uuid = unique();
                this.jobs.set(uuid, job);
                job.catch((err: Error) => {
                    this.log().error(`Job ${uuid} is finished with error: ${err.message}`);
                }).finally(() => {
                    this.job().remove(uuid);
                });
                return uuid;
            },
            remove: (uuid: string): void => {
                this.jobs.delete(uuid);
                this.shutdown().track();
            },
        };
    }

    protected shutdown(): {
        init(): void;
        track(): void;
    } {
        return {
            init: (): void => {
                if (this.state.done === undefined) {
                    this.log().warn(`Cannot init shutdown because finish-handler isn't created`);
                    return;
                }
                if (this.state.forced) {
                    this.log().debug(
                        `Shutdown is requested in forced mode. All jobs will be canceled`,
                    );
                    this.jobs.forEach((job) => job.abort());
                }
                this.shutdown().track();
            },
            track: (): void => {
                if (this.state.done === undefined) {
                    return;
                }
                if (this.jobs.size > 0) {
                    this.log().debug(
                        `Cannot shutdown, still waiting for ${this.jobs.size} jobs to be finished`,
                    );
                    return;
                }
                this.state.done();
            },
        };
    }
}
export interface Service extends Interface {}
export const sys = register(new Service());
