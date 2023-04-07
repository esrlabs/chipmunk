import { Logger as Base, Level, utils, state } from '@platform/log';

import * as Events from '@platform/ipc/event';

const WRITE_TO_BACKEND = [Level.ERROR, Level.WARNING, Level.DEBUG, Level.INFO];

export function cutUuid(uuid: string): string {
    return uuid.substring(0, 6);
}

export class Logger extends Base {
    public static backendAllowed: boolean = false;
    public static backend(): {
        allow(): void;
        disallow(): void;
    } {
        return {
            allow: (): void => {
                Logger.backendAllowed = true;
            },
            disallow: (): void => {
                Logger.backendAllowed = false;
            },
        };
    }

    public override store(message: string, level: Level): void {
        if (!Logger.backendAllowed) {
            return;
        }
        if (!WRITE_TO_BACKEND.includes(level)) {
            return;
        }
        if (!state.isWritable(level)) {
            return;
        }
        try {
            Events.IpcEvent.emit(
                new Events.Logs.Write.Event({
                    message,
                    level,
                }),
            );
        } catch (e) {
            console.error(`Fail to send to backend logs: ${utils.error(e)}`);
        }
    }
}
