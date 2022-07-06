import { IOptions } from './options';
import { unique } from '@platform/env/sequence';

export class Handler<T> {
    public readonly priority: number = 1;
    public readonly uuid: string = unique();
    protected handler: (event: T) => boolean;

    constructor(handler: (event: T) => boolean, options?: IOptions) {
        options = options === undefined ? {} : options;
        this.priority = options.priority !== undefined ? options.priority : this.priority;
        this.handler = handler;
    }

    public proccess(event: T): boolean {
        return this.handler(event);
    }
}
