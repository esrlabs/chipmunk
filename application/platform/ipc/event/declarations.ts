import { Subject, Subscription } from '../../env/subscription';
import { decoratorFactory, DecoratorConstructor } from '../../env/decorators';
import { scope } from '../../env/scope';
import { ISignatureRequirement, EntityConstructor, SignatureRequirement } from '../transport/index';

export { EntityConstructor, SignatureRequirement };

export class IpcEvent<E extends {}> {
    readonly _eventBodyConstructor: EntityConstructor<E> & ISignatureRequirement;
    private _subject!: Subject<E>;
    private _subscriptions: Subscription[] = [];

    constructor(eventBodyConstructor: EntityConstructor<E> & ISignatureRequirement) {
        this._eventBodyConstructor = eventBodyConstructor;
    }

    public destroy() {
        this._subscriptions.forEach((subscription: Subscription) => {
            subscription.destroy();
        });
    }

    public subscribe(handler: (event: E) => void): Subscription {
        const signature = this._eventBodyConstructor.getSignature();
        if (typeof signature !== 'string' || signature.trim() === '') {
            throw new Error(`No event signature has been found.`);
        }
        const subscription = (() => {
            if (this._subject === undefined) {
                this._subject = scope
                    .getTransport()
                    .subscribe(signature, this._eventBodyConstructor) as any;
            }
            return this._subject.subscribe(handler);
        })();
        this._subscriptions.push(subscription);
        return subscription;
    }

    public emit(event: E & ISignatureRequirement) {
        const signature = this._eventBodyConstructor.getSignature();
        if (typeof signature !== 'string' || signature.trim() === '') {
            throw new Error(`No event signature has been found.`);
        }
        scope.getTransport().notify(event);
    }

    public static subscribe<E>(
        eventBodyConstructor: EntityConstructor<E> & ISignatureRequirement,
        handler: (event: E & ISignatureRequirement) => void,
    ): Subscription {
        const signature = eventBodyConstructor.getSignature();
        if (typeof signature !== 'string' || signature.trim() === '') {
            throw new Error(`No event signature has been found.`);
        }
        return scope
            .getTransport()
            .subscribe(signature, eventBodyConstructor)
            .subscribe(handler as any);
    }

    public static emit(event: ISignatureRequirement) {
        const signature = event.getSignature();
        if (typeof signature !== 'string' || signature.trim() === '') {
            throw new Error(`No event signature has been found.`);
        }
        scope.getTransport().notify(event);
    }

    public static emulate(event: ISignatureRequirement) {
        const signature = event.getSignature();
        if (typeof signature !== 'string' || signature.trim() === '') {
            throw new Error(`No event signature has been found.`);
        }
        scope.getTransport().emulate(event).event();
    }
}

export interface Inputs {
    name: string;
}

export interface Interface {
    getSignature(): string;
}

export const Define = decoratorFactory<Inputs>((constructor: DecoratorConstructor, obj: Inputs) => {
    /// TODO: check and prevent names conflicts. One name "obj.name" could be used only once
    const name = obj.name;
    constructor.prototype.getSignature = (): string => {
        return name;
    };
    (constructor as any).getSignature = constructor.prototype.getSignature;
    return class extends constructor {};
});
