import { Base } from './state';
import { unique } from '@platform/env/sequence';

export const KEY: string = unique();

export class State extends Base {

    public key(): string {
        return KEY;
    }
}
