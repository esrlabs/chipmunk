import { Packed } from '@platform/ipc/transport/index';
import { unique } from '@platform/env/sequence';
import { processOutgoingEvent } from './events.outgoing';
import { processOutgoingRequest } from './requests.outgoing';

import * as events from '@platform/ipc/setup/channels';

const SUBSCRIPTION_UUID_PROP = '__ipc_subscription_uuid__';

function verifySubscriptionChannelValid(channel: string) {
    if (
        ![events.HOST_EVENT_NAME, events.HOST_REQUEST_NAME, events.HOST_RESPONSE_NAME].includes(
            channel,
        )
    ) {
        throw new Error(
            `Not expected channel name for subscription: ${channel}. Expecting:\n${[
                events.HOST_EVENT_NAME,
                events.HOST_REQUEST_NAME,
                events.HOST_RESPONSE_NAME,
            ].join('\n')}`,
        );
    }
}

function setSubscriptionUuid(callback: (...args: any[]) => void): void {
    (callback as any)[SUBSCRIPTION_UUID_PROP] = unique();
}

function getSubscriptionUuid(callback: (...args: any[]) => void): string {
    return (callback as any)[SUBSCRIPTION_UUID_PROP] as string;
}

export class Emulation {
    private _subscriptions: Map<string, Array<(...args: any[]) => void>> = new Map();

    public send(channel: string, msg: Packed): void {
        switch (channel) {
            case events.RENDER_EVENT_NAME:
                processOutgoingEvent(msg);
                return;
            case events.RENDER_REQUEST_NAME:
                processOutgoingRequest(msg);
                return;
            case events.RENDER_RESPONSE_NAME:
                return;
            case events.HOST_EVENT_NAME:
            case events.HOST_REQUEST_NAME:
            case events.HOST_RESPONSE_NAME: {
                const handlers = this._subscriptions.get(channel);
                if (handlers === undefined) {
                    return;
                }
                handlers.forEach((handler) => {
                    handler({}, msg);
                });
                return;
            }
        }
        throw new Error(
            `Not expected channel name for sending: ${channel}. Expecting:\n${[
                events.RENDER_EVENT_NAME,
                events.RENDER_REQUEST_NAME,
                events.RENDER_RESPONSE_NAME,
                events.HOST_EVENT_NAME,
                events.HOST_REQUEST_NAME,
                events.HOST_RESPONSE_NAME,
            ].join('\n')}`,
        );
    }

    public subscribe(channel: string, callback: (...args: any[]) => void): void {
        verifySubscriptionChannelValid(channel);
        let handlers = this._subscriptions.get(channel);
        if (handlers === undefined) {
            handlers = [];
        }
        setSubscriptionUuid(callback);
        handlers.push(callback);
        this._subscriptions.set(channel, handlers);
    }

    public unsubscribe(channel: string, callback: (...args: any[]) => void): void {
        verifySubscriptionChannelValid(channel);
        let handlers = this._subscriptions.get(channel);
        if (handlers === undefined) {
            return;
        }
        const uuid = getSubscriptionUuid(callback);
        handlers = handlers.filter((handler) => {
            return getSubscriptionUuid(handler) !== uuid;
        });
        this._subscriptions.set(channel, handlers);
    }

    public unsubscribeAll(channel: string): void {
        verifySubscriptionChannelValid(channel);
        this._subscriptions.delete(channel);
    }

    public emit(channel: string, ...args: any[]) {
        verifySubscriptionChannelValid(channel);
        const handlers = this._subscriptions.get(channel);
        if (handlers === undefined) {
            return;
        }
        handlers.forEach((handler) => {
            handler(...args);
        });
    }
}

const emulation = new Emulation();

export { emulation };
