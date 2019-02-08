// tslint:disable:only-arrow-functions

export enum EMessageSource {
    main = 'main',
    render = 'render',
    plugin = 'plugin',
}

export interface IMessage {
    sequence?: string;
    source?: EMessageSource;
    command?: string;
    data?: any;
    created?: number;
}

export const getSequence: () => string = (function() {
    let sequence: number = Date.now();
    return function() {
        return `${process.pid}:${sequence++}`;
    };
}());

export class IPCMessage {

    public sequence: string = '';
    public source: EMessageSource = EMessageSource.plugin;
    public command: string | undefined;
    public data: any;
    public created: number;

    constructor(params: IMessage) {
        if (typeof params !== 'object' || params === null || (params.command === undefined && params.data === undefined)) {
            throw new Error(`At least property "data" or "command" should be defined`);
        }
        if (typeof params.sequence !== 'string' || params.sequence.trim() === '') {
            params.sequence = getSequence();
        }
        if (params.source !== undefined && [EMessageSource.main, EMessageSource.plugin, EMessageSource.render].indexOf(params.source) === -1) {
            throw new Error(`Unexpected type of message source`);
        }
        if (params.source === undefined) {
            params.source = EMessageSource.plugin;
        }
        if (params.created === undefined) {
            params.created = Date.now();
        }
        this.sequence = params.sequence;
        this.source = params.source;
        this.command = params.command;
        this.data = params.data;
        this.created = params.created;
    }

}
