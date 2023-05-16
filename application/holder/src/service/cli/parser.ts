import { CLIAction, Type } from './action';
import { Service } from '@service/cli';
import { ParserName } from 'platform/types/observe';

export class Action extends CLIAction {
    static parsers = ['dlt', 'pcapng', 'text'];

    protected parser: ParserName | undefined;
    protected error: Error[] = [];

    // static help(): {
    //     keys: string;
    //     desc: string;
    //     examples: string[];
    // } {
    //     return {
    //         keys: ARGS.join(' '),
    //         desc: `Will apply setup parser, which would be used to decode content. By default would be used plaint text parser (no decoding).`,
    //         examples: [
    //             `syntaxt: cm --parser dlt|text|pcap`,
    //             `cm --parser dlt --tcp "0.0.0.0:8888"`,
    //             `cm -P dlt --tcp "0.0.0.0:8888" -S "error"`,
    //         ],
    //     };
    // }

    public name(): string {
        return 'Definition of parser';
    }

    public argument(_cwd: string, arg: string): string {
        switch (arg) {
            case 'dlt':
                this.parser = ParserName.Dlt;
                return arg;
            case 'someip':
                this.parser = ParserName.Someip;
                return arg;
            case 'text':
                this.parser = ParserName.Text;
                return arg;
        }
        this.error.push(
            new Error(`Invalid value of parser: ${arg}. Available: ${Action.parsers.join(', ')}.`),
        );
        return '';
    }

    public errors(): Error[] {
        return this.error;
    }

    public execute(cli: Service): Promise<void> {
        if (this.error.length > 0) {
            return Promise.reject(
                new Error(
                    `Handler cannot be executed, because errors: \n${this.error
                        .map((e) => e.message)
                        .join('\n')}`,
                ),
            );
        }
        if (this.parser === undefined) {
            return Promise.resolve();
        }
        cli.state().parser(this.parser);
        return Promise.resolve();
    }

    public type(): Type {
        return Type.StateModifier;
    }

    public defined(): boolean {
        return this.parser !== undefined;
    }
}
