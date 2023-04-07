import { ICancelablePromise } from '../../env/promise';
import { utils } from '../../log';
import { Subject, Subscription } from '../../env/subscription';

import * as Errors from './errors';
import * as setup from '../setup/channels';

export { Errors };

export function wrapResponseConstructor<Entity>(
    signature: string,
    constructorRef: EntityConstructor<Entity>,
): EntityConstructor<Entity> & ISignatureRequirement {
    (constructorRef as any).getSignature = function () {
        return signature;
    };
    return constructorRef as EntityConstructor<Entity> & ISignatureRequirement;
}

export interface ISignatureRequirement {
    getSignature(): string;
}

export abstract class SignatureRequirement {
    static getSignature(): string {
        return '';
    }
}

export type EntityConstructor<Entity> = new (...args: any[]) => Entity;

export type Respond<Request, Entity> = (
    request: Request & ISignatureRequirement,
) => ICancelablePromise<Entity & ISignatureRequirement>;

export abstract class Transport {
    public abstract request<Request, Response>(
        request: Request & ISignatureRequirement,
        responseConstructorRef: EntityConstructor<Response> & ISignatureRequirement,
    ): Promise<Response>;

    public abstract respondent<Request, Response>(
        owner: unknown,
        request: EntityConstructor<Request> & ISignatureRequirement,
        respond: Respond<Request, Response>,
    ): Subscription;

    public abstract notify<Notification>(notification: Notification & ISignatureRequirement): void;

    public abstract emulate<Entity>(entity: Entity & ISignatureRequirement): {
        event(): void;
        request(): void;
        response(sequence: number): void;
    };

    public abstract subscribe<Event>(
        event: string,
        refEventConstructor: EntityConstructor<Event> & ISignatureRequirement,
    ): Subject<typeof refEventConstructor>;

    public abstract destroy(): void;
}

export interface Packed {
    [key: string]: unknown;
}

export class Package<Payload> {
    private _sequence: number;
    private _payload: (Payload & ISignatureRequirement) | undefined;
    private _packed: Packed | undefined;
    private _signature: string | undefined;
    private _code: number = setup.CODES.unknown;
    private _error: string | undefined;

    constructor(sequence: number, packed?: Packed) {
        this._sequence = sequence;
        packed !== undefined && (this._packed = packed);
    }

    public static from<Payload>(
        obj: Packed,
        ref?: EntityConstructor<Payload> & ISignatureRequirement,
    ): Error | Package<Payload> {
        if (
            typeof obj !== 'object' ||
            obj === null ||
            typeof obj[setup.SEQUENCE_FIELD] !== 'number'
        ) {
            return this.err(`Unexpected request's structure`);
        }
        if (
            (obj[setup.PAYLOAD_FIELD] !== undefined &&
                typeof obj[setup.PAYLOAD_FIELD] !== 'object') ||
            obj[setup.PAYLOAD_FIELD] === null
        ) {
            return this.err(`Payload isn't an object`);
        }
        if (
            typeof obj[setup.PAYLOAD_FIELD] === 'object' &&
            Object.keys(obj[setup.PAYLOAD_FIELD] as object).length !== 1
        ) {
            return this.err(
                `Payload has incorrect structure. It should has only one field by name of signature.`,
            );
        }
        if (obj[setup.ERROR_FIELD] !== undefined && typeof obj[setup.ERROR_FIELD] !== 'string') {
            return this.err(`Error can be only a string`);
        }
        if (obj[setup.PAYLOAD_FIELD] !== undefined && obj[setup.ERROR_FIELD] !== undefined) {
            return this.err(`Payload and error cannot be defined in the scope of one package`);
        }
        if (obj[setup.ERROR_FIELD] !== undefined && obj[setup.CODE_FIELD] !== setup.CODES.error) {
            return this.err(`Incorrect code for error`);
        }
        if (
            obj[setup.PAYLOAD_FIELD] !== undefined &&
            obj[setup.CODE_FIELD] === setup.CODES.aborted
        ) {
            return this.err(`Payload cannot be defined on aborting`);
        }
        const pack = new Package<Payload>(obj[setup.SEQUENCE_FIELD] as number, obj)
            .code(obj[setup.CODE_FIELD] as number)
            .error(obj[setup.ERROR_FIELD] as string);
        if (ref !== undefined && obj[setup.PAYLOAD_FIELD] !== undefined) {
            const signature = pack.getSignature();
            if (pack instanceof Error) {
                return pack;
            }
            try {
                pack.payload(
                    new ref(
                        (obj[setup.PAYLOAD_FIELD] as { [key: string]: unknown })[
                            signature as string
                        ],
                    ) as Payload & ISignatureRequirement,
                );
            } catch (err) {
                return this.err(utils.error(err));
            }
        }
        return pack;
    }

    public done(response: Payload & ISignatureRequirement): Package<Payload> {
        this._payload = response;
        this._code = setup.CODES.done;
        return this;
    }

    public error(error: string | undefined): Package<Payload> {
        if (error === undefined) {
            return this;
        }
        this._error = error;
        this._code = setup.CODES.error;
        return this;
    }

    public abort(): Package<Payload> {
        if (this._error !== undefined || this._payload !== undefined) {
            throw this.err(`State of package already setuo. Cannot apply `);
        }
        this._code = setup.CODES.aborted;
        return this;
    }

    public code(code: number): Package<Payload> {
        this._code = code;
        return this;
    }

    public payload(payload: Payload & ISignatureRequirement): Package<Payload> {
        this._code = setup.CODES.done;
        this._payload = payload;
        return this;
    }

    public getCode(): number {
        return this._code;
    }

    public getError(): Error | Errors.RustNativeError | undefined {
        if (this._error === undefined) {
            return undefined;
        }
        const native = Errors.RustNativeError.from(this._error);
        return native === undefined ? new Error(this._error) : native;
    }

    public getPayload(
        ref?: EntityConstructor<Payload> & ISignatureRequirement,
    ): (Payload & ISignatureRequirement) | Error {
        if (ref !== undefined) {
            if (this._packed === undefined) {
                return this.err(`Cannot build payload without packed content`);
            }
            const signature = this.getSignature();
            if (signature instanceof Error) {
                return signature;
            }
            try {
                this.payload(
                    new ref(
                        (this._packed[setup.PAYLOAD_FIELD] as { [key: string]: unknown })[
                            signature as string
                        ],
                    ) as Payload & ISignatureRequirement,
                );
            } catch (err) {
                return this.err(utils.error(err));
            }
        }
        return this._payload !== undefined ? this._payload : this.err(`No payload`);
    }

    public getSequence(): number {
        return this._sequence;
    }

    public getSignature(): string | Error {
        if (this._packed === undefined || this._packed[setup.PAYLOAD_FIELD] === undefined) {
            return this.err(`no packed contect or not payload part`);
        }
        if (
            this._packed[setup.PAYLOAD_FIELD] === null ||
            (typeof this._packed[setup.PAYLOAD_FIELD] === 'object' &&
                Object.keys(this._packed[setup.PAYLOAD_FIELD] as object).length !== 1)
        ) {
            return this.err(
                `Payload has incorrect structure. It should has only one field by name of signature.`,
            );
        }
        const signature = Object.keys(this._packed[setup.PAYLOAD_FIELD] as object)[0];
        if (typeof signature !== 'string' || signature.trim() === '') {
            return this.err(`Invalid signature format`);
        }
        return signature;
    }

    public aborded(): boolean {
        return this._code === setup.CODES.aborted;
    }

    public packed(): Packed {
        const packed: Packed = {
            [setup.SEQUENCE_FIELD]: this._sequence,
            [setup.CODE_FIELD]: this._code,
        };
        if (this._payload !== undefined) {
            packed[setup.PAYLOAD_FIELD] = {
                [this._payload.getSignature()]: this._payload,
            };
        } else if (this._error !== undefined) {
            packed[setup.ERROR_FIELD] = this._error;
        }
        this._packed = packed;
        return packed;
    }

    static err(msg: string): Error {
        return new Error(`PackageError: ${msg}`);
    }

    private err(msg: string): Error {
        return Package.err(msg);
    }
}
