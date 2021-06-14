import { Action } from './action';
import { setLogLevels } from '../../../ts-bindings/src/util/logging';

const KEYS: string[] = [`--nologs`, `-nl`];

let logs: boolean = true;

export function isOutputAllowed(): boolean {
    return logs;
}

export class Output extends Action {

    public name(): string {
        return `Prevent any logs`;
    }

    public key(): string[] {
        return KEYS;
    }

    public pattern(): string {
        return `${KEYS[0]}`
    }

    public valid(args: string[]): Promise<void> {
        return Promise.resolve();
    }

    public proceed(args: string[]): Promise<string[]> {
        logs = !this._isCalled(args);
        if (!logs) {
            setLogLevels(0);
        }
        return Promise.resolve(args.filter(v => KEYS.indexOf(v) === -1));
    }

    private _isCalled(args: string[]): boolean {
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

export default new Output();
