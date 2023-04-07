import { decoratorFactory, DecoratorConstructor } from '../env/decorators';
import { getWithDefaults } from '../env/obj';
import { scope } from '../env/scope';
import { Logger } from '../log';
import { unique } from '../env/sequence';
import { Subscriber } from '../env/subscription';

export interface Inputs {
    name: string;
    uuid: string;
}

export interface Interface {
    getName(): string;
    getUuid(): string;
    getDepencencies(): Array<Interface & Implementation>;
    log(): Logger;
}

export abstract class Implementation extends Subscriber {
    /**
     * Initialization of service.
     * Service can do some work for initialization
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return Promise.resolve();
    }
    /**
     * Method will be called after all services are inited
     * @returns Promise<void>
     */
    public ready(): Promise<void> {
        return Promise.resolve();
    }
    // /**
    //  * Method will be called right after method "ready" to confirm: service is ready for work
    //  * @returns Promise<void>
    //  */
    // public reaffirm(): Promise<void> {
    //     return Promise.resolve();
    // }
    public destroy(): Promise<void> {
        this.unsubscribe();
        return Promise.resolve();
    }
}

const DEPENDENCY_PROP: string = unique();
const UUID_PROP: string = unique();

const services: Map<string, Interface & Implementation> = new Map();

export function register<T>(service: T & Interface & Implementation) {
    services.set(service.getUuid(), service);
    return service;
}

export function getRegistred(): Map<string, Interface & Implementation> {
    return services;
}

/**
 * Note! Properties will not be available in constructor of service's implementation
 */
export const SetupService = decoratorFactory<Inputs>(
    (constructor: DecoratorConstructor, obj: Inputs) => {
        const logger = scope.getLogger(`S: ${obj.name}`);
        logger.debug(`service is declared`);
        return class extends constructor {
            __name: string = obj.name;
            __uuid: string = getWithDefaults<string>(constructor, UUID_PROP, obj.uuid);
            __logger: Logger = logger;
            public getName(): string {
                if (this === undefined || this.__name === undefined) {
                    throw new Error(`Service ${obj.name} isn't inited`);
                }
                return this.__name;
            }
            public getDepencencies(): Array<Implementation & Interface> {
                return getWithDefaults(constructor, DEPENDENCY_PROP, []);
            }
            public getUuid(): string {
                if (this === undefined || this.__uuid === undefined) {
                    throw new Error(`Service ${obj.name} isn't inited`);
                }
                return this.__uuid;
            }
            public log(): Logger {
                if (this === undefined || this.__logger === undefined) {
                    throw new Error(`Service ${obj.name} isn't inited`);
                }
                return this.__logger;
            }
        };
    },
);

export const DependOn = decoratorFactory<Interface>(
    (owner: DecoratorConstructor, depenceny: Interface) => {
        getWithDefaults<Interface[]>(owner, DEPENDENCY_PROP, []).push(depenceny);
        return undefined;
    },
);
