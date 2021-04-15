import { Action } from './action';

import OpenFile from './action.open.file';


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
            [OpenFile, this].forEach((action: Action) => {
                console.log(`${action.key()} (${action.pattern()})\t- ${action.name()}`);
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
