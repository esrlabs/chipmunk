import { SetupService, Interface, Implementation, register, getRegistred } from '../entity/service';
import { utils, Logger } from '../log';

import { scope } from '../env/scope';
import { unique } from '../env/sequence';
import { Subject } from '../env/subscription';

const SERVICE_DEF = {
    name: 'system',
    uuid: unique(),
};

export interface Destroyer {
    destroyer: () => Promise<void>;
    owner: string;
}

@SetupService(SERVICE_DEF)
export class Service extends Implementation {
    private _inited: Array<Implementation & Interface> = [];
    private _register: Map<string, Implementation & Interface> = new Map();
    private _logger: Logger = scope.getLogger(SERVICE_DEF.name);
    private _destroyers: Set<Destroyer> = new Set();
    public readonly subjects: {
        inited: Subject<void>;
        ready: Subject<void>;
    } = {
        inited: new Subject<void>(),
        ready: new Subject<void>(),
    };

    public override async init(hooks?: {
        // Will be triggered before sending "ready" to each service
        before?: () => Promise<void>;
        // Will be triggered after "ready" sent to each service
        after?: () => Promise<void>;
    }): Promise<void> {
        const inited = this._inited;
        const register = this._register;
        const logger = this._logger;
        logger.debug(`initing services...`);
        async function initialize(
            service: Interface & Implementation,
            uuids: string[],
        ): Promise<string> {
            if (uuids.includes(service.getUuid())) {
                return service.getUuid();
            }
            service.getDepencencies().forEach(async (dependency) => {
                if (uuids.includes(dependency.getUuid())) {
                    return;
                }
                const uuid = await initialize(dependency, uuids);
                uuids.push(uuid);
            });
            await service.init();
            logger.debug(`service "${service.getName()}" inited`);
            inited.unshift(service);
            register.set(service.getUuid(), service);
            uuids.push(service.getUuid());
            return service.getUuid();
        }
        const services = Array.from(getRegistred().values()).filter(
            (s) => s.getUuid() !== this.getUuid(),
        );
        const uuids: string[] = [this.getUuid()];
        for (const service of services) {
            try {
                await initialize(service, uuids);
            } catch (err: unknown) {
                logger.error(
                    `Fail to init service "${service.getName()}" (${service.getUuid()}): ${utils.error(
                        err,
                    )}`,
                );
                return Promise.reject(new Error(utils.error(err)));
            }
        }
        logger.debug(`all services are inited...`);
        this.subjects.inited.emit();
        if (hooks !== undefined && hooks.before !== undefined) {
            await hooks.before();
        }
        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                for (const service of services) {
                    try {
                        await service.ready();
                    } catch (err: unknown) {
                        logger.error(
                            `Fail to set "ready" state to service "${service.getName()}" (${service.getUuid()}): ${utils.error(
                                err,
                            )}`,
                        );
                        return reject(new Error(utils.error(err)));
                    }
                }
                if (hooks !== undefined && hooks.after !== undefined) {
                    await hooks.after();
                }
                resolve();
                this.subjects.ready.emit();
            });
        });
    }

    public override async destroy(): Promise<void> {
        for (const service of this._inited) {
            try {
                await service.destroy();
                this._logger.debug(`service "${service.getName()}" destroyed`);
            } catch (err) {
                return Promise.reject(new Error(utils.error(err)));
            }
        }
        await Promise.all(
            Array.from(this._destroyers.values()).map((desc) => {
                return desc.destroyer().catch((err: Error) => {
                    this.log().error(
                        `Fail to call destroyer of ${desc.owner}. Error: ${err.message}`,
                    );
                });
            }),
        ).catch(() => {
            this.log().error(`Fail to call all destroyers`);
        });
        return Promise.resolve();
    }

    public doOnDestroy(owner: string, destroyer: () => Promise<void>): void {
        this._destroyers.add({
            owner,
            destroyer,
        });
    }

    public getByUuid<S extends Implementation & Interface>(uuid: string): S {
        const target = this._register.get(uuid);
        if (target === undefined) {
            throw new Error(`Requested service "${uuid}" has not been found`);
        }
        return target as S;
    }

    public getServicesAccessor<S extends Implementation & Interface>(): (uuid: string) => S {
        return this.getByUuid.bind(this);
    }

    public state(): {
        ready(): boolean;
        inited(): boolean;
    } {
        const subjects = this.subjects;
        return {
            ready: (): boolean => {
                return subjects.ready.emitted();
            },
            inited: (): boolean => {
                return subjects.inited.emitted();
            },
        };
    }

    public isReady(): boolean {
        return this.subjects.ready.emitted();
    }
}
export interface Service extends Interface {}

export const system = register(new Service());
