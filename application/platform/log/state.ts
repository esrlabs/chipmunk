import { Level, LOGS_LEVEL_TABLE, isValid } from './levels';

export class State {
    protected level!: Level;
    protected allowed!: { [key: string]: boolean };
    protected lockedBy: string | undefined;
    protected debugging: boolean = false;

    constructor() {
        this.setLevel(Level.DEBUG);
    }

    public setLevel(level: Level): Error | undefined {
        if (this.lockedBy !== undefined) {
            return new Error(`Locked by ${this.lockedBy}`);
        }
        if (!isValid(level)) {
            return new Error(`Log level "${level}" is invalid`);
        }
        this.level = level;
        this.allowed = {};
        Object.keys(LOGS_LEVEL_TABLE).forEach((key: string) => {
            this.allowed[key] = LOGS_LEVEL_TABLE[level].includes(key as Level);
        });
        this.allowed[Level.WTF] = true;
        return undefined;
    }

    public isWritable(level: Level): boolean {
        return typeof this.allowed[level] === 'boolean' ? this.allowed[level] : false;
    }

    public lock(lockedBy: string): Error | undefined {
        if (this.lockedBy !== undefined) {
            return new Error(`Already locked by ${this.lockedBy}`);
        }
        this.lockedBy = lockedBy;
        return undefined;
    }

    public isDebugging(): boolean {
        return this.debugging;
    }

    public setDebugging(state: boolean): void {
        this.debugging = state;
    }
}

export const state = new State();
