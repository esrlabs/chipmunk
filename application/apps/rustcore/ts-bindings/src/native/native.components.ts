import { scope } from 'platform/env/scope';
import { getNativeModule } from '../native/native';
import { Type, Source, NativeError } from '../interfaces/errors';
import { SourceOrigin, IdentList, ComponentsOptions } from 'platform/types/bindings';
import { Logger, utils } from 'platform/log';
import { TEventEmitter } from '../provider/provider.general';
import { Computation } from '../provider/provider';
import { Subscriber } from 'platform/env/subscription';
import {
    IComponentsEvents,
    IComponentsEventsSignatures,
    IComponentsEventsInterfaces,
} from '../api/components.provider';

import * as protocol from 'protocol';

export abstract class ComponentsNative {
    public abstract init(callback: TEventEmitter): Promise<void>;

    public abstract destroy(): Promise<void>;

    public abstract getSources(origin: Uint8Array): Promise<Uint8Array>;

    public abstract getParsers(origin: Uint8Array): Promise<Uint8Array>;

    public abstract getOptions(
        source: string,
        parser: string,
        origin: Uint8Array,
    ): Promise<Uint8Array>;

    public abstract abort(fields: string[]): void;
}

const DESTROY_TIMEOUT = 5000;

enum State {
    Destroyed,
    Destroying,
    Available,
    Created,
    Unavailable,
}

type DestroyResolver = () => void;

export class Base extends Subscriber {
    protected readonly logger: Logger = scope.getLogger(`Components`);
    protected readonly native: ComponentsNative;
    protected readonly provider: Computation<
        IComponentsEvents,
        IComponentsEventsSignatures,
        IComponentsEventsInterfaces
    >;
    private state: State = State.Created;
    private destroyResolver: DestroyResolver | undefined;

    constructor(
        provider: Computation<
            IComponentsEvents,
            IComponentsEventsSignatures,
            IComponentsEventsInterfaces
        >,
        resolver: (err: Error | undefined) => void,
    ) {
        super();
        this.native = new (getNativeModule().Components)() as ComponentsNative;
        this.logger.debug(`Rust Components native session is created`);
        this.provider = provider;
        this.register(
            this.provider.getEvents().Destroy.subscribe(() => {
                this.state = State.Destroyed;
                if (this.destroyResolver === undefined) {
                    this.logger.error(`Session has been destroyed before call of "destroy"`);
                    this.state = State.Unavailable;
                    return;
                }
                this.logger.error(`Destroy session confirmation has been gotten`);
                // Confirm destroying
                this.destroyResolver();
                // Shutdown provider to drop all subscriptions
                this.provider.destroy();
            }),
        );
        this.native
            .init(provider.getEmitter())
            .then(() => {
                this.logger.debug(`Rust Components native session is inited`);
                this.state = State.Available;
                resolver(undefined);
            })
            .catch((err: Error) => {
                this.logger.error(
                    `Fail to init Components session: ${err instanceof Error ? err.message : err}`,
                );
                resolver(err);
            });
    }

    public destroy(): Promise<void> {
        const err = this.getSessionAccessErr();
        if (err instanceof Error) {
            return Promise.reject(err);
        }
        this.state = State.Destroying;
        return new Promise((resolve, reject) => {
            this.destroyResolver = () => {
                clearTimeout(timeout);
                resolve();
            };
            const timeout = setTimeout(() => {
                this.state = State.Unavailable;
                reject(
                    new Error(
                        this.logger.error(
                            `Timeout error. Session wasn't closed in ${
                                DESTROY_TIMEOUT / 1000
                            } sec.`,
                        ),
                    ),
                );
            }, DESTROY_TIMEOUT);
            this.native
                .destroy()
                .then(() => {
                    this.logger.debug(
                        `Signal to destroy session has been sent. Wait for confirmation`,
                    );
                })
                .catch((err: Error) => {
                    this.logger.error(
                        `Fail to send destroy signal due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    );
                    this.state = State.Unavailable;
                    reject(err);
                });
        });
    }

    public getSources(origin: SourceOrigin): Promise<IdentList> {
        const err = this.getSessionAccessErr();
        if (err instanceof Error) {
            return Promise.reject(err);
        }
        return new Promise((resolve, reject) => {
            this.native.getSources(protocol.encodeSourceOrigin(origin)).then((buf: Uint8Array) => {
                try {
                    resolve(protocol.decodeIdentList(buf));
                } catch (err) {
                    reject(
                        new NativeError(
                            new Error(
                                this.logger.error(`Fail to decode message: ${utils.error(err)}`),
                            ),
                            Type.InvalidOutput,
                            Source.IdentList,
                        ),
                    );
                }
            });
        });
    }

    public getParsers(origin: SourceOrigin): Promise<IdentList> {
        const err = this.getSessionAccessErr();
        if (err instanceof Error) {
            return Promise.reject(err);
        }
        return new Promise((resolve, reject) => {
            this.native.getParsers(protocol.encodeSourceOrigin(origin)).then((buf: Uint8Array) => {
                try {
                    resolve(protocol.decodeIdentList(buf));
                } catch (err) {
                    reject(
                        new NativeError(
                            new Error(
                                this.logger.error(`Fail to decode message: ${utils.error(err)}`),
                            ),
                            Type.InvalidOutput,
                            Source.IdentList,
                        ),
                    );
                }
            });
        });
    }

    public getOptions(
        source: string,
        parser: string,
        origin: SourceOrigin,
    ): Promise<ComponentsOptions> {
        const err = this.getSessionAccessErr();
        if (err instanceof Error) {
            return Promise.reject(err);
        }
        return new Promise((resolve, reject) => {
            this.native
                .getOptions(source, parser, protocol.encodeSourceOrigin(origin))
                .then((buf: Uint8Array) => {
                    try {
                        resolve(protocol.decodeComponentsOptions(buf));
                    } catch (err) {
                        reject(
                            new NativeError(
                                new Error(
                                    this.logger.error(
                                        `Fail to decode message: ${utils.error(err)}`,
                                    ),
                                ),
                                Type.InvalidOutput,
                                Source.ComponentsOptions,
                            ),
                        );
                    }
                });
        });
    }

    public abort(fields: string[]): Error | undefined {
        const err = this.getSessionAccessErr();
        if (err instanceof Error) {
            return err;
        }
        try {
            this.native.abort(fields);
            return undefined;
        } catch (err) {
            return NativeError.from(err);
        }
    }

    protected getSessionAccessErr(): Error | undefined {
        switch (this.state) {
            case State.Destroying:
                return new Error(`Session is already in destroy process`);
            case State.Destroyed:
                return new Error(`Session is already destroyed`);
            case State.Created:
                return new Error(`Session wasn't inited yet`);
            case State.Unavailable:
                return new Error(`Session is unavailable`);
            case State.Available:
                return undefined;
        }
    }
}
