import { wrapResponseConstructor } from '../transport';
import { decoratorFactory, DecoratorConstructor } from '../../env/decorators';
import { scope } from '../../env/scope';
import { ISignatureRequirement, EntityConstructor, SignatureRequirement } from '../transport/index';
export { EntityConstructor, SignatureRequirement };
import { Logger } from '../../log';

export { Logger };

export const InjectLogger = function <R, T>(
    handler: (log: Logger, request: R & ISignatureRequirement) => T,
): (...args: any[]) => T {
    return (request: R & ISignatureRequirement): T => {
        return handler(scope.getLogger(`R: ${request.getSignature()}`), request);
    };
};

export class IpcRequest<Q extends ISignatureRequirement, A extends {}> {
    readonly _responseConstructor: EntityConstructor<A> & ISignatureRequirement;

    constructor(responseConstructor: EntityConstructor<A> & ISignatureRequirement) {
        this._responseConstructor = responseConstructor;
    }

    public send(request: Q): Promise<A> {
        const signature = request.getSignature();
        if (typeof signature !== 'string' || signature.trim() === '') {
            return Promise.reject(new Error(`No request signature has been found.`));
        }
        return scope
            .getTransport()
            .request(request, wrapResponseConstructor<A>(signature, this._responseConstructor));
    }

    public static send<A extends {}>(
        responseConstructor: EntityConstructor<A> & ISignatureRequirement,
        request: ISignatureRequirement,
    ): Promise<A> {
        const signature = request.getSignature();
        if (typeof signature !== 'string' || signature.trim() === '') {
            return Promise.reject(new Error(`No request signature has been found.`));
        }
        return scope
            .getTransport()
            .request(request, wrapResponseConstructor<A>(signature, responseConstructor));
    }

    public static emulate(entity: ISignatureRequirement): {
        request(): void;
        response(sequence: number): void;
    } {
        const signature = entity.getSignature();
        if (typeof signature !== 'string' || signature.trim() === '') {
            throw new Error(`No entity signature has been found.`);
        }
        return {
            request: () => {
                scope.getTransport().emulate(entity).request();
            },
            response: (sequence: number) => {
                scope.getTransport().emulate(entity).response(sequence);
            },
        };
    }
}

export interface Inputs {
    name: string;
}

export interface Interface {
    getSignature(): string;
}

export const Define = decoratorFactory<Inputs>((constructor: DecoratorConstructor, obj: Inputs) => {
    const name = obj.name;
    constructor.prototype.getSignature = (): string => {
        return name;
    };
    (constructor as any).getSignature = constructor.prototype.getSignature;
    return class extends constructor {};
});
