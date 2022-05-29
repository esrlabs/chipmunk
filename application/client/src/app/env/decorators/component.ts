import { singleDecoratorFactory, DecoratorConstructor } from '@platform/env/decorators';
import { scope } from '@platform/env/scope';
import { Instance as Logger } from '@platform/env/logger';
import { getComponentSelector } from '@env/reflect';
import { ilc, Channel, Emitter, Declarations, Services } from '@service/ilc';
import { unique } from '@platform/env/sequence';
import { Subscriber } from '@platform/env/subscription';
import { DomSanitizer } from '@angular/platform-browser';

export { Channel, Emitter, Declarations };

export interface InternalAPI {
    channel: Channel;
    emitter: Emitter;
    services: Services;
    logger: Logger;
}

export interface Env {
    subscriber: Subscriber;
}

export interface IlcInterface {
    log(): Logger;
    ilc(): InternalAPI;
    env(): Env;
}

const UUID_KEY = '__ilc_uuid_key___';
const instances: Map<string, { api: InternalAPI; env: Env }> = new Map();

function getIlcInstance(entity: any, selector: string): { api: InternalAPI; env: Env } {
    if (entity[UUID_KEY] === undefined) {
        entity[UUID_KEY] = unique();
    }
    const uuid = entity[UUID_KEY];
    let instance = instances.get(uuid);
    if (instance === undefined) {
        const logger = scope.getLogger(`COM: ${selector}`);
        instance = {
            api: {
                channel: ilc.channel(selector, logger),
                emitter: ilc.emitter(selector, logger),
                services: ilc.services(selector, logger),
                logger,
            },
            env: {
                subscriber: new Subscriber(),
            },
        };
        instances.set(uuid, instance);
    }
    return instance;
}

function removeIlcInstance(entity: any): void {
    const uuid = entity[UUID_KEY];
    if (uuid === undefined) {
        return;
    }
    let instance = instances.get(uuid);
    if (instance === undefined) {
        return;
    }
    instance.api.channel.destroy();
    instance.api.emitter.destroy();
    instance.api.services.destroy();
    instance.env.subscriber.unsubscribe();
    instances.delete(uuid);
}

export const Ilc = singleDecoratorFactory((constructor: DecoratorConstructor) => {
    const selector: string | undefined = getComponentSelector(constructor);
    if (selector === undefined) {
        throw new Error(`Fail to detect selector for angular component`);
    }
    constructor.prototype.log = function (): Logger {
        return getIlcInstance(this, selector).api.logger;
    };
    constructor.prototype.ilc = function (): InternalAPI {
        return getIlcInstance(this, selector).api;
    };
    constructor.prototype.env = function (): Env {
        return getIlcInstance(this, selector).env;
    };
    const ngOnDestroy = constructor.prototype.ngOnDestroy;
    if (ngOnDestroy === undefined) {
        constructor.prototype.ngOnDestroy = function () {
            removeIlcInstance(this);
        };
    } else {
        constructor.prototype.ngOnDestroy = function () {
            ngOnDestroy.call(this);
            removeIlcInstance(this);
        };
    }
    return class extends constructor {};
});
