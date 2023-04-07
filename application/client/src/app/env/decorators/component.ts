import { singleDecoratorFactory, DecoratorConstructor } from '@platform/env/decorators';
import { scope } from '@platform/env/scope';
import { Logger } from '@platform/log';
import { getSelector } from '@env/reflect';
import {
    ilc,
    Channel,
    Emitter,
    Declarations,
    InternalAPI,
    Env,
    IlcInterface,
    Accessor,
    Life,
} from '@service/ilc';
import { unique } from '@platform/env/sequence';
import { Subscriber } from '@platform/env/subscription';
import { Session, UnboundTab } from '@service/session';

export { Channel, Emitter, Declarations, IlcInterface, Env };

const UUID_KEY = '__ilc_uuid_key___';
const instances: Map<
    string,
    { api: InternalAPI; env: Env; access: Accessor; life: Life; distructors: Array<() => void> }
> = new Map();

function getIlcInstance(
    entity: any,
    selector: string,
): { api: InternalAPI; env: Env; access: Accessor; life: Life } {
    if (entity[UUID_KEY] === undefined) {
        entity[UUID_KEY] = unique();
    }
    const uuid = entity[UUID_KEY];
    let instance = instances.get(uuid);
    if (instance === undefined) {
        const logger = scope.getLogger(`COM: ${selector}`);
        const sessions = ilc.services(selector, logger);
        instance = {
            distructors: [],
            api: {
                channel: ilc.channel(selector, logger),
                emitter: ilc.emitter(selector, logger),
                services: sessions,
                logger,
            },
            env: {
                subscriber: new Subscriber(),
            },
            access: {
                session: (cb: (session: Session) => void): boolean => {
                    const inside = sessions.system.session.active().session();
                    if (inside === undefined) {
                        return false;
                    }
                    cb(inside);
                    return true;
                },
                unbound: (cb: (session: UnboundTab) => void): boolean => {
                    const inside = sessions.system.session.active().unbound();
                    if (inside === undefined) {
                        return false;
                    }
                    cb(inside);
                    return true;
                },
            },
            life: {
                destroy: (handler: () => void) => {
                    const instance = instances.get(uuid);
                    if (instance === undefined) {
                        return;
                    }
                    instance.distructors.push(handler);
                },
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
    const instance = instances.get(uuid);
    if (instance === undefined) {
        return;
    }
    instance.distructors.forEach((distructor) => distructor());
    instance.api.channel.destroy();
    instance.api.emitter.destroy();
    instance.env.subscriber.unsubscribe();
    instances.delete(uuid);
}

export const Ilc = singleDecoratorFactory((constructor: DecoratorConstructor) => {
    const selector: string | undefined = getSelector(constructor);
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
    constructor.prototype.access = function (): Accessor {
        return getIlcInstance(this, selector).access;
    };
    constructor.prototype.life = function (): Life {
        return getIlcInstance(this, selector).life;
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
