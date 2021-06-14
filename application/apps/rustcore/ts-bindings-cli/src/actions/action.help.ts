import { Action } from './action';

import OpenFile from './action.open.file';
import SearchInFile from './action.search';
import Output from './action.output';


const KEYS: string[] = [`--help`, `-h`];

export class Help extends Action {

    public name(): string {
        return `Print help`;
    }

    public key(): string[] {
        return KEYS;
    }

    public pattern(): string {
        return `${KEYS[0]} or ${KEYS[1]}`
    }

    public valid(args: string[]): Promise<void> {
        return Promise.resolve();
    }

    public proceed(args: string[]): Promise<string[]> {
        return new Promise((resolve, reject) => {
            if (!this._hasKeys(args)) {
                return resolve(args);
            }
            const columns = {
                key: 0,
                pattern: 0,
                name: 0,
            };
            const TAB: number = 4;
            Object.keys(columns).forEach((key: string) => {
                [OpenFile, SearchInFile, this].forEach((action: Action) => {
                    let value = (action as any)[key]();
                    if (value instanceof Array) {
                        value = value.join(' ');
                    }
                    if (value.length > (columns as any)[key]) {
                        (columns as any)[key] = value.length;
                    }
                });
                (columns as any)[key] += TAB;
            });
            [Output, OpenFile, SearchInFile, this].forEach((action: Action) => {
                let output: string = '';
                Object.keys(columns).forEach((key: string) => {
                    let value = (action as any)[key]();
                    if (value instanceof Array) {
                        value = value.join(' ');
                    }
                    value += ' '.repeat((columns as any)[key] - value.length);
                    output += value;
                });
                console.log(output);
            });
            resolve(args);
        });
    }

    private _hasKeys(args: string[]): boolean {
        const index: number = (() => {
            let i: number = -1;
            KEYS.forEach((key: string) => {
                if (i === -1) {
                    i = args.indexOf(key);
                }
            });
            return i;
        })();
        return index !== -1;
    }

}

export default new Help();
