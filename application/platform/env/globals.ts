const KEY = '__CHIPMUNK_GLOBAL_SCOPE__';

declare const global: { [key: string]: any };
declare const window: { [key: string]: any };

const scoped: { [key: string]: any } = {};

export class Globals {
    protected scope(): { [key: string]: any } {
        if (typeof global === 'object') {
            return global;
        } else if (typeof window === 'object') {
            return window;
        } else {
            return scoped;
        }
    }

    protected storage(): { [key: string]: any } {
        const scope = this.scope();
        if (scope[KEY] === undefined) {
            scope[KEY] = {};
        }
        return scope[KEY];
    }
    public get<T>(key: string): T | undefined {
        const storage = this.storage();
        return storage[key];
    }

    public set<T>(key: string, value: T): void {
        const storage = this.storage();
        storage[key] = value;
    }
}

export const globals = new Globals();
