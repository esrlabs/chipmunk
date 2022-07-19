import { Record } from './storage.record';

export class BoolOrUndefined extends Record<boolean | undefined> {
    public validate(value: boolean | undefined): Error | undefined {
        if (value === undefined) {
            return undefined;
        }
        if (typeof value !== 'boolean') {
            return new Error(`Expecting boolean or undefined`);
        }
        return undefined;
    }
}

export class NotEmptyStringOrUndefined extends Record<string | undefined> {
    public validate(value: string | undefined): Error | undefined {
        if (value === undefined) {
            return undefined;
        }
        if (typeof value !== 'string' || value.trim() === '') {
            return new Error(`Expecting not empty string or undefined`);
        }
        return undefined;
    }
}

export class NotEmptyString extends Record<string> {
    public validate(value: string): Error | undefined {
        if (typeof value !== 'string' || value.trim() === '') {
            return new Error(`Expecting not empty string or undefined`);
        }
        return undefined;
    }
}

export class AnyString extends Record<string> {
    public validate(value: string): Error | undefined {
        if (typeof value !== 'string') {
            return new Error(`Expecting string`);
        }
        return undefined;
    }
}

export class AnyStringOrUndefined extends Record<string | undefined> {
    public validate(value: string | undefined): Error | undefined {
        if (value === undefined) {
            return undefined;
        }
        if (typeof value !== 'string') {
            return new Error(`Expecting string or undefined`);
        }
        return undefined;
    }
}

export class IntOrUndefined extends Record<number | undefined> {
    public validate(value: number | undefined): Error | undefined {
        if (value === undefined) {
            return undefined;
        }
        if (typeof value !== 'number' || !isFinite(value) || isNaN(value)) {
            return new Error(`Expecting valid number or undefined`);
        }
        return undefined;
    }
}

export class Int extends Record<number> {
    public validate(value: number): Error | undefined {
        if (typeof value !== 'number' || !isFinite(value) || isNaN(value)) {
            return new Error(`Expecting valid number`);
        }
        return undefined;
    }
}
