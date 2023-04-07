import { decoratorFactory, DecoratorConstructor } from '../env/decorators';
import {
    Inputs as ServiceInputs,
    Implementation as ServiceImplementation,
    Interface as ServiceInterface,
} from './service';
import { getWithDefaults } from '../env/obj';
import { scope } from '../env/scope';
import { Logger } from '../log';
import { unique } from '../env/sequence';

export interface Inputs {
    name: string;
    parent: ServiceInputs;
    accessor<P extends ServiceImplementation & ServiceInterface>(uuid: string): P;
}

export interface Interface {
    getName(): string;
    getUuid(): string;
    log(): Logger;
    parent<P extends ServiceImplementation & ServiceInterface>(): P;
}

export abstract class Implementation {
    public destroy(): Promise<void> {
        return Promise.resolve();
    }
}

const UUID_PROP: string = unique();

export const Define = decoratorFactory<Inputs>((constructor: DecoratorConstructor, obj: Inputs) => {
    if (!obj) {
        throw new Error(`Fail to declare controller. Invalid inputs.`);
    }
    if (!obj.parent) {
        throw new Error(`Fail to declare controller "${obj.name}". Invalid parent.`);
    }
    const logger = scope.getLogger(`C (${obj.parent.name}): ${obj.name}`);
    logger.debug(`controller is declared`);
    return class extends constructor {
        __name: string = obj.name;
        __uuid: string = getWithDefaults<string>(constructor, UUID_PROP, unique());
        __parent: string = obj.parent.uuid;
        __logger: Logger = logger;
        public getName(): string {
            if (this === undefined || this.__name === undefined) {
                throw new Error(`Controller ${obj.name} isn't inited`);
            }
            return this.__name;
        }
        public getUuid(): string {
            if (this === undefined || this.__uuid === undefined) {
                throw new Error(`Controller ${obj.name} isn't inited`);
            }
            return this.__uuid;
        }
        public log(): Logger {
            if (this === undefined || this.__logger === undefined) {
                throw new Error(`Controller ${obj.name} isn't inited`);
            }
            return this.__logger;
        }
        public parent<P extends ServiceImplementation & ServiceInterface>(): P {
            if (this === undefined || this.__parent === undefined) {
                throw new Error(`Controller ${obj.name} isn't inited`);
            }
            return obj.accessor(this.__parent);
        }
    };
});
