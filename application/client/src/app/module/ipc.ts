import { Packed } from '@platform/ipc/transport/index';

declare global {
    interface Window {
        electron: {
            ipc: IPC;
        };
    }
}

export function isAvailable(): boolean {
    return window.electron !== undefined && window.electron !== null;
}

export interface IPC {
    send: (channel: string, msg: Packed) => void;
    subscribe: (channel: string, callback: (...args: any[]) => void) => void;
    unsubscribe: (channel: string, callback: (...args: any[]) => void) => void;
    unsubscribeAll: (channel: string) => void;
}
