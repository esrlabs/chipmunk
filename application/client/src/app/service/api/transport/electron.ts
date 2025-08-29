/**
 * Provides the IPC transport implementation for duplex communication
 * between the frontend and the Electron backend.
 *
 * This transport supports the following interaction modes:
 * - Sending requests to the backend and awaiting a response.
 * - Sending fire-and-forget events to the backend (without delivery confirmation).
 * - Subscribing to events emitted by the backend.
 * - Subscribing to requests initiated by the backend.
 *
 * @remarks
 * Fire-and-forget events do not generate any acknowledgment - neither the client
 * nor the backend confirms their receipt. However, the logging system is designed
 * to detect and warn about the following cases:
 * - The backend sends a request, but no corresponding request handler exists on the client.
 * - The backend emits an event, but there are no listeners registered on the client.
 * - Likewise, if the client sends events or requests without registered consumers on the backend.
 *
 * Since all event subscriptions and request handlers are registered during the application
 * initialization phase, developers should carefully monitor these warnings in logs. Such messages
 * may indicate:
 * - An initialization order issue where some components are not yet ready when communication starts.
 * - A partially completed refactoring in which obsolete events or requests are still being sent.
 *
 * All events, requests, and responses between the client and backend are defined in a central location:
 * `application/platform/ipc`. To introduce a new message type, it must first be declared there.
 *
 * @module
 * @internal
 */
import {
    Transport,
    EntityConstructor,
    Respond,
    ISignatureRequirement,
    Package,
    Packed,
    Errors,
} from '@platform/ipc/transport/index';
import { error } from '@platform/log/utils';
import { Subject, Subscription } from '@platform/env/subscription';
import { IPC, isAvailable } from '@module/ipc';
import { Logger } from '@log/index';
import { getNgZoneSafly } from '@ui/env/globals';

import * as events from '@platform/ipc/setup/channels';

// If some request takes more than LONG_REQUEST_ALERT (ms),
// warn message will be logged
const LONG_REQUEST_ALERT = 2000;

/**
 * Returns the implementation of the IPC transport or throws an error if it is not available.
 *
 * @remarks
 * This error is considered critical and is treated as a client-side panic,
 * since the application cannot function without a working IPC layer.
 * This typically indicates a misconfigured or missing integration with the Electron backend.
 *
 * @throws {Error} Thrown if no IPC transport is found on the `window.electron` object.
 *
 * @returns {IPC} The IPC transport implementation.
 *
 * @internal
 */
function ipc(): IPC {
    if (isAvailable()) {
        return window.electron.ipc;
    } else {
        throw new Error(`No IPC transport has been found`);
    }
}

interface IEventDesc {
    subject: Subject<any>;
    ref: EntityConstructor<any> & ISignatureRequirement;
}

interface PendingEntity {
    resolver: (...args: any[]) => void;
    rejector: (error: Error | Errors.RustNativeError) => void;
    ref: EntityConstructor<any> & ISignatureRequirement;
    sent: number;
}

/**
 * IPC transport wrapper around the native Electron IPC interface.
 *
 * @remarks
 * This class is responsible for:
 * - Tracking pending request–response pairs using an internal queue.
 * - Dispatching received messages to the appropriate subscribers.
 * - Logging warnings about unhandled events or unmatched request handlers.
 *
 * It extends a base `Transport` class and serves as the main implementation
 * for communication with the Electron backend in duplex mode.
 *
 * @internal
 */
export class Implementation extends Transport {
    /**
     * A registry of known event types and their metadata.
     * Used to validate and route incoming messages.
     */
    private _subjects: Map<string, IEventDesc> = new Map();

    /**
     * Internal logger instance scoped to this transport.
     */
    private _log: Logger = new Logger('ElectronAPITransport');

    /**
     * Sequence number used to uniquely identify outgoing requests.
     */
    private _sequence = 0;

    /**
     * Tracks all pending requests waiting for responses.
     * Maps sequence numbers to their associated state and handlers.
     */
    private _requests: Map<number, PendingEntity> = new Map();

    /**
     * Handlers for backend-initiated requests.
     * Each entry includes the owning module, a responder function,
     * and a reference to the expected request signature.
     */
    private _respondents: Map<
        string,
        {
            owner: string;
            respond: Respond<any, any>;
            ref: EntityConstructor<any> & ISignatureRequirement;
        }
    > = new Map();

    /**
     * Indicates whether the transport has been destroyed.
     * Once destroyed, no further communication is possible.
     */
    private _destroyed: boolean = false;

    constructor() {
        super();
        this._onHostEvent = this._onHostEvent.bind(this);
        this._onHostRequest = this._onHostRequest.bind(this);
        this._onHostResponse = this._onHostResponse.bind(this);
        ipc().subscribe(events.HOST_EVENT_NAME, this._onHostEvent);
        ipc().subscribe(events.HOST_REQUEST_NAME, this._onHostRequest);
        ipc().subscribe(events.HOST_RESPONSE_NAME, this._onHostResponse);
    }

    public destroy(): void {
        ipc().unsubscribeAll(events.HOST_EVENT_NAME);
        ipc().unsubscribeAll(events.HOST_REQUEST_NAME);
        ipc().unsubscribeAll(events.HOST_RESPONSE_NAME);
        this._requests.forEach((request) => {
            request.rejector(new Error(`Rejected because transport is destroying`));
        });
        this._requests.clear();
        this._respondents.clear();
    }

    /**
     * Sends a request to the Electron backend and waits for a corresponding response.
     *
     * @typeParam Request - The request type. Must implement a signature identifier.
     * @typeParam Response - The expected response type. Must implement a signature identifier.
     *
     * @remarks
     * This method initiates a typed request–response cycle between the frontend and the backend.
     * It guarantees that the received response matches the expected response type by checking
     * an internal signature defined by `ISignatureRequirement`. If a mismatched response is received,
     * an error is thrown instead of resolving the promise.
     *
     * Note, however, that only the structural signature of the response is verified at this level.
     * The semantic validity of the response payload is not enforced and must be handled in
     * the corresponding implementation within `application/platform/ipc`.
     *
     * A timeout mechanism is not currently implemented, meaning unresolved requests
     * may hang indefinitely if the backend fails to respond.
     *
     * @param request - The request payload object. Must carry an internal signature for validation.
     * @param responseConstructorRef - The constructor of the expected response type, used to validate
     * the incoming response against its declared structure.
     *
     * @returns A promise that resolves with the validated response or rejects with an error
     * if the response is invalid, mismatched, or if the transport is already destroyed.
     *
     * @throws {Error} If the transport has already been destroyed before sending the request.
     *
     * @public
     */
    public request<Request, Response>(
        request: Request & ISignatureRequirement,
        responseConstructorRef: EntityConstructor<Response> & ISignatureRequirement,
    ): Promise<Response> {
        if (this._destroyed) {
            return Promise.reject(new Error(`Transport is destroyed`));
        }
        return new Promise((resolve, reject) => {
            const pack = new Package(this._getSequence()).payload(request);
            this._requests.set(pack.getSequence(), {
                resolver: resolve,
                rejector: reject,
                ref: responseConstructorRef,
                sent: Date.now(),
            });
            ipc().send(events.RENDER_REQUEST_NAME, pack.packed());
            // TODO: add timeout
        });
    }

    /**
     * Registers a handler on the client side for a specific request type sent from the backend.
     *
     * @typeParam Request - The type of the request to handle. Must implement a signature identifier.
     * @typeParam Response - The type of the response to return. Must implement a signature identifier.
     *
     * @remarks
     * This method binds an incoming backend-initiated request to a handler (`respond`) provided by the client.
     * The handler is responsible for producing and sending back a valid response of the expected type.
     *
     * Only one handler can be registered per unique request signature. Attempting to register a second handler
     * for the same request type will result in an error, with diagnostic information about the current owner.
     *
     * The returned `Subscription` object allows the consumer to unregister the handler by calling `.destroy()`,
     * which removes the association from the internal registry.
     *
     * @param owner - A human-readable identifier (e.g. module or service name) used for diagnostics and logging.
     * @param request - The request constructor. Its signature is used to uniquely identify the handled request type.
     * @param respond - The function that handles the request and returns a response.
     *
     * @returns A `Subscription` object that can be destroyed to remove the handler.
     *
     * @throws {Error} If a handler has already been registered for the same request signature.
     *
     * @public
     */
    public respondent<Request, Response>(
        owner: string,
        request: EntityConstructor<Request> & ISignatureRequirement,
        respond: Respond<Request, Response>,
    ): Subscription {
        const signature: string = request.getSignature();
        const respondent = this._respondents.get(signature);
        if (respondent !== undefined) {
            throw new Error(
                `Respondent has been setup already for "${signature}". Owner: ${respondent.owner}`,
            );
        }
        this._respondents.set(signature, {
            owner,
            ref: request,
            respond,
        });
        return new Subscription(`${owner}:${signature}`, () => {
            this._respondents.delete(signature);
        });
    }

    /**
     * Sends a fire-and-forget event (notification) from the client to the backend.
     *
     * @typeParam Notification - The type of the event to be sent. Must implement a signature identifier.
     *
     * @remarks
     * This method emits an event to the Electron backend without expecting any response or acknowledgment.
     * Delivery is not guaranteed - the client will not be informed whether the backend received or processed the event.
     *
     * However, if there are no listeners registered on the backend for the emitted event type, a warning will be logged.
     * The log entry includes the event signature and diagnostic information to help identify misconfigured or outdated subscriptions.
     *
     * If the transport has already been destroyed, the method silently returns without sending anything.
     *
     * @param notification - The event payload to be sent. Must carry a unique signature for type identification.
     *
     * @returns void
     *
     * @public
     */
    public notify<Notification>(notification: Notification & ISignatureRequirement): void {
        if (this._destroyed) {
            return;
        }
        ipc().send(
            events.RENDER_EVENT_NAME,
            new Package(this._getSequence()).payload(notification).packed(),
        );
    }

    /**
     * Internal utility for testing purposes that emulates sending an event, request, or response
     * from the backend to the client.
     *
     * @typeParam Entity - The type of the entity to emulate. Must implement a signature identifier.
     *
     * @remarks
     * This method is intended exclusively for development and testing scenarios.
     * It provides mechanisms to simulate backend-originated communication without requiring
     * an actual backend process. This is useful for unit tests, mocking, or frontend-only development.
     *
     * Each returned method sends a synthetic message with the appropriate event name and payload format:
     * - `event()` - simulates a backend event.
     * - `request()` - simulates a backend-initiated request.
     * - `response(sequence)` - simulates a response with a specified sequence ID.
     *
     * These emulations trigger the same internal dispatch logic as real backend messages.
     *
     * @param entity - The mock message entity to be sent. Must carry a valid signature for routing.
     *
     * @returns An object with methods to emulate:
     * - `event()` - emit as if it's a backend event.
     * - `request()` - emit as if it's a backend request.
     * - `response(sequence)` - emit as if it's a response with a given sequence number.
     *
     * @internal
     */
    public emulate<Entity>(entity: Entity & ISignatureRequirement): {
        event(): void;
        request(): void;
        response(sequence: number): void;
    } {
        return {
            event: () => {
                ipc().send(
                    events.HOST_EVENT_NAME,
                    new Package(this._getSequence()).payload(entity).packed(),
                );
            },
            request: () => {
                ipc().send(
                    events.HOST_REQUEST_NAME,
                    new Package(this._getSequence()).payload(entity).packed(),
                );
            },
            response: (sequence: number) => {
                ipc().send(
                    events.HOST_RESPONSE_NAME,
                    new Package(sequence).payload(entity).packed(),
                );
            },
        };
    }

    /**
     * Subscribes to an event emitted by the Electron backend.
     *
     * @typeParam Event - The expected type of the event payload. Must implement a signature identifier.
     *
     * @remarks
     * This method allows the client to listen for a specific event type originating from the backend.
     * If the subscription for the event does not exist yet, a new `Subject` is created and stored
     * internally. All future messages with the same event name will be routed through this subject.
     *
     * The event name must be a non-empty string. An error will be thrown if this constraint is not met.
     *
     * The returned `Subject` can be used to register callbacks via `.subscribe(...)` and receive
     * strongly typed event payloads as defined by the corresponding constructor.
     *
     * @param event - The name of the backend event to subscribe to.
     * @param refEventConstructor - The constructor used to validate and typecast incoming event payloads.
     *
     * @returns A `Subject` instance used to receive event notifications of the specified type.
     *
     * @throws {Error} If the provided event name is not a valid non-empty string.
     *
     * @public
     */
    public subscribe<Event>(
        event: string,
        refEventConstructor: EntityConstructor<Event> & ISignatureRequirement,
    ): Subject<typeof refEventConstructor> {
        if (typeof event !== 'string' || event.trim() === '') {
            throw new Error(`Event name should be a not-empty string`);
        }
        let desc: IEventDesc | undefined = this._subjects.get(event);
        if (desc === undefined) {
            desc = {
                subject: new Subject<typeof refEventConstructor>(),
                ref: refEventConstructor,
            };
            this._subjects.set(event, desc);
        }
        return desc.subject;
    }

    private _getSequence(): number {
        return this._sequence++;
    }

    private _zone(handler: () => void) {
        const ngZone = getNgZoneSafly();
        ngZone === undefined ? handler() : ngZone.run(handler);
    }

    private _onHostEvent(_event: unknown, message: Packed) {
        const pack = Package.from(message);
        if (pack instanceof Error) {
            this._log.error(`Fail to parse income event: ${pack.message}`);
            return;
        }
        const signature = pack.getSignature();
        if (signature instanceof Error) {
            this._log.error(`Has been gotten event, but signature cannot be detected`);
            return;
        }
        const desc: IEventDesc | undefined = this._subjects.get(signature);
        if (desc === undefined) {
            this._log.warn(`Event ${signature} has been gotten, but no subscribers has been found`);
            return;
        }
        const payload = pack.getPayload(desc.ref);
        if (payload instanceof Error) {
            this._log.error(`Error with processing event "${signature}": ${payload.message}`);
            return;
        }
        this._log.verbose(`Event ${signature} has been gotten and successfully constructed.`);
        this._zone(() => {
            desc.subject.emit(payload);
        });
    }

    private _onHostRequest(_event: unknown, message: Packed) {
        const pack = Package.from(message);
        if (pack instanceof Error) {
            this._log.error(`Fail to parse income event: ${pack.message}`);
            return;
        }
        const signature = pack.getSignature();
        if (signature instanceof Error) {
            this._log.error(`Has been gotten event, but signature cannot be detected`);
            return;
        }
        const respondent = this._respondents.get(signature);
        if (respondent === undefined) {
            this._log.error(`No respondent for "${signature}" has been setup`);
            return;
        }
        const payload = pack.getPayload(respondent.ref);
        if (payload instanceof Error) {
            this._log.error(
                `Error with processing host request "${signature}": ${payload.message}`,
            );
            return;
        }
        this._log.verbose(
            `Request ${signature} (seq: ${pack.getSequence()}) has been gotten and successfully constructed.`,
        );
        this._zone(() => {
            respondent
                .respond(payload)
                .then((response: ISignatureRequirement) => {
                    ipc().send(
                        events.RENDER_RESPONSE_NAME,
                        new Package(pack.getSequence()).payload(response).packed(),
                    );
                })
                .canceled(() => {
                    ipc().send(
                        events.RENDER_RESPONSE_NAME,
                        new Package(pack.getSequence()).abort().packed(),
                    );
                })
                .catch((err: Error) => {
                    ipc().send(
                        events.RENDER_RESPONSE_NAME,
                        new Package(pack.getSequence()).error(error(err)).packed(),
                    );
                });
        });
    }

    private _onHostResponse(_event: unknown, message: Packed) {
        const pack = Package.from(message);
        if (pack instanceof Error) {
            this._log.error(`Fail to parse income event: ${pack.message}`);
            return;
        }
        const desc = this._requests.get(pack.getSequence());
        const signature = pack.getSignature();
        if (desc === undefined) {
            this._log.warn(
                `Has been gotten response "${
                    signature instanceof Error ? 'unknown' : signature
                }"; sequence: ${pack.getSequence()}. But pending entity isn't found.`,
            );
            return;
        }
        this._requests.delete(pack.getSequence());
        const error = pack.getError();
        if (error !== undefined) {
            desc.rejector(error);
            return;
        }
        if (signature instanceof Error) {
            this._log.error(`Has been gotten response, but signature cannot be detected`);
            return;
        }
        const payload = pack.getPayload(desc.ref);
        if (payload instanceof Error) {
            desc.rejector(payload);
            return;
        }
        if (LONG_REQUEST_ALERT < Date.now() - desc.sent) {
            this._log.warn(
                `Request ${payload.getSignature()}(${pack.getSequence()}) took too long (${
                    Date.now() - desc.sent
                }ms)`,
            );
        }
        this._zone(() => {
            desc.resolver(payload);
        });
    }
}
