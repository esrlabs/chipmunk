import { Level } from './levels';
import { Logger as Base } from './logger';

let collected: { msg: string; level: Level }[] = [];

export class DefaultLogger extends Base {
    public static getCollectedMessages(): { msg: string; level: Level }[] {
        const msgs = collected;
        collected = [];
        return msgs;
    }

    public store(msg: string, level: Level): void {
        collected.push({ msg, level });
    }
    public isDefault(): boolean {
        return true;
    }
}
