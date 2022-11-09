import { CLIAction, Type } from './action';
import { Service } from '@service/cli';
import { ParserName } from 'platform/types/observe';

const ARGS = ['-P', '--parser'];

export class Action extends CLIAction {
    static help(): {
        keys: string;
        desc: string;
        examples: string[];
    } {
        return {
            keys: ARGS.join(' '),
            desc: `Will apply setup parser, which would be used to decode content. By default would be used plaint text parser (no decoding).`,
            examples: [
                `syntaxt: cm --parser dlt|text|pcap`,
                `cm --parser dlt --tcp "0.0.0.0:8888"`,
                `cm -P dlt --tcp "0.0.0.0:8888" -S "error"`,
            ],
        };
    }

    public name(): string {
        return 'Definition of parser';
    }

    public execute(cli: Service, args: string[]): Promise<string[]> {
        const checked = this.find(args);
        if (checked.parser === undefined) {
            return Promise.resolve(checked.args);
        }
        if (checked.parser instanceof Error) {
            return Promise.reject(checked.parser);
        }
        switch (checked.parser) {
            case 'dlt':
                cli.state().parser(ParserName.Dlt);
                break;
            case 'pcap':
                cli.state().parser(ParserName.Pcap);
                break;
            case 'text':
                cli.state().parser(ParserName.Text);
                break;
        }
        return Promise.resolve(checked.args);
    }

    public test(_cwd: string, args: string[]): string[] | Error {
        const checked = this.find(args);
        if (checked.parser instanceof Error) {
            return checked.parser;
        }
        return checked.args;
    }

    public type(): Type {
        return Type.StateModifier;
    }

    protected find(args: string[]): { args: string[]; parser: string | Error | undefined } {
        const flag = args.findIndex((arg) => ARGS.includes(arg));
        if (flag === -1) {
            return { args, parser: undefined };
        }
        if (flag === args.length - 1) {
            args.pop();
            return {
                args,
                parser: new Error(`Parser value isn't defined, even parser flag has been found`),
            };
        }
        const parser = args[flag + 1];
        if (parser.trim().startsWith('-')) {
            args.pop();
            return { args, parser: new Error(`Parser value is skipped`) };
        }
        if (!['dlt', 'pcap', 'text'].includes(parser)) {
            return { args, parser: new Error(`Invalid value of parser`) };
        }
        args.splice(flag, 2);
        return { args, parser };
    }
}
