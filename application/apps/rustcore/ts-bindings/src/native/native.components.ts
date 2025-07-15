import { scope } from 'platform/env/scope';
import { getNativeModule } from '../native/native';
import { Type, Source, NativeError } from '../interfaces/errors';
import {
    SessionAction,
    IdentList,
    ComponentsOptionsList,
    ComponentType,
    Field,
    ComponentOptions,
    FieldsValidationErrors,
    OutputRender,
    Ident,
} from 'platform/types/bindings';
import { Logger, utils } from 'platform/log';
import { TEventEmitter } from '../provider/provider.general';
import { Computation } from '../provider/provider';
import { Subscriber } from 'platform/env/subscription';
import { IComponentsEvents, IComponentsEventsSignatures } from '../api/components.provider';

import * as protocol from 'protocol';

export abstract class ComponentsNative {
    public abstract init(callback: TEventEmitter): Promise<void>;

    public abstract destroy(): Promise<void>;

    public abstract getComponents(origin: Uint8Array, ty: Uint8Array): Promise<Uint8Array>;

    public abstract getOptions(origin: Uint8Array, targets: string[]): Promise<Uint8Array>;

    public abstract getOutputRender(uuid: String): Promise<Uint8Array | null>;

    public abstract getIdent(uuid: String): Promise<Uint8Array | null>;

    public abstract validate(origin: Uint8Array, fields: Uint8Array): Promise<Uint8Array>;

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
    protected readonly provider: Computation<IComponentsEvents, IComponentsEventsSignatures>;
    private state: State = State.Created;
    private destroyResolver: DestroyResolver | undefined;

    constructor(
        provider: Computation<IComponentsEvents, IComponentsEventsSignatures>,
        resolver: (err: Error | undefined) => void,
    ) {
        super();
        this.native = new (getNativeModule().Components)() as ComponentsNative;
        this.logger.debug(`Rust Components native session is created`);
        this.provider = provider;
        this.register(
            this.provider.getEvents().Destroyed.subscribe(() => {
                this.state = State.Destroyed;
                if (this.destroyResolver === undefined) {
                    this.logger.error(`Session has been destroyed before call of "destroy"`);
                    this.state = State.Unavailable;
                    return;
                }
                this.logger.debug(`Destroy session confirmation has been gotten`);
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

    public getComponents(origin: SessionAction, ty: ComponentType): Promise<IdentList> {
        const err = this.getSessionAccessErr();
        if (err instanceof Error) {
            return Promise.reject(err);
        }
        return new Promise((resolve, reject) => {
            this.native
                .getComponents(
                    protocol.encodeSessionAction(origin),
                    protocol.encodeComponentType(ty),
                )
                .then((buf: Uint8Array) => {
                    try {
                        resolve(protocol.decodeIdentList(buf));
                    } catch (err) {
                        reject(
                            new NativeError(
                                new Error(
                                    this.logger.error(
                                        `Fail to decode message: ${utils.error(err)}`,
                                    ),
                                ),
                                Type.InvalidOutput,
                                Source.IdentList,
                            ),
                        );
                    }
                });
        });
    }

    public getOptions(origin: SessionAction, targets: string[]): Promise<ComponentsOptionsList> {
        const err = this.getSessionAccessErr();
        if (err instanceof Error) {
            return Promise.reject(err);
        }
        return new Promise((resolve, reject) => {
            this.native
                .getOptions(protocol.encodeSessionAction(origin), targets)
                .then((buf: Uint8Array) => {
                    try {
                        resolve(protocol.decodeComponentsOptionsList(buf));
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

    public getOutputRender(uuid: String): Promise<OutputRender | null> {
        const err = this.getSessionAccessErr();
        if (err instanceof Error) {
            return Promise.reject(err);
        }
        return new Promise((resolve, reject) => {
            this.native.getOutputRender(uuid).then((buf: Uint8Array | null) => {
                if (!buf) {
                    return resolve(null);
                }
                try {
                    resolve(protocol.decodeOutputRender(buf));
                } catch (err) {
                    reject(
                        new NativeError(
                            new Error(
                                this.logger.error(`Fail to decode message: ${utils.error(err)}`),
                            ),
                            Type.InvalidOutput,
                            Source.ComponentsOptions,
                        ),
                    );
                }
            });
        });
    }

    public getIdent(uuid: String): Promise<Ident | null> {
        const err = this.getSessionAccessErr();
        if (err instanceof Error) {
            return Promise.reject(err);
        }
        return new Promise((resolve, reject) => {
            this.native.getIdent(uuid).then((buf: Uint8Array | null) => {
                if (!buf) {
                    return resolve(null);
                }
                try {
                    resolve(protocol.decodeIdent(buf));
                } catch (err) {
                    reject(
                        new NativeError(
                            new Error(
                                this.logger.error(`Fail to decode message: ${utils.error(err)}`),
                            ),
                            Type.InvalidOutput,
                            Source.GetIdent,
                        ),
                    );
                }
            });
        });
    }

    public validate(
        origin: SessionAction,
        target: string,
        fields: Field[],
    ): Promise<FieldsValidationErrors> {
        const err = this.getSessionAccessErr();
        if (err instanceof Error) {
            return Promise.reject(err);
        }
        const options: ComponentOptions = { fields: fields, uuid: target };
        return new Promise((resolve, reject) => {
            this.native
                .validate(
                    protocol.encodeSessionAction(origin),
                    protocol.encodeComponentOptions(options),
                )
                .then((buf: Uint8Array) => {
                    try {
                        resolve(protocol.decodeFieldsValidationErrors(buf));
                    } catch (err) {
                        reject(
                            new NativeError(
                                new Error(
                                    this.logger.error(
                                        `Fail to decode message: ${utils.error(err)}`,
                                    ),
                                ),
                                Type.InvalidOutput,
                                Source.ComponentsValidate,
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
