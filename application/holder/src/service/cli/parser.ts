import { CLIAction, Type } from './action';
import { Service } from '@service/cli';

export class Action extends CLIAction {
    // protected parser: Protocol | undefined;
    protected error: Error[] = [];

    public argument(_target: string | undefined, _cwd: string, arg: string): string {
        // switch (arg.toLowerCase()) {
        //     case Protocol.Dlt.toLowerCase():
        //         this.parser = Protocol.Dlt;
        //         return arg;
        //     case Protocol.SomeIp.toLowerCase():
        //         this.parser = Protocol.SomeIp;
        //         return arg;
        //     case Protocol.Text.toLowerCase():
        //         this.parser = Protocol.Text;
        //         return arg;
        // }
        // this.error.push(
        //     new Error(
        //         `Invalid value of parser: ${arg}. Available: ${[
        //             Protocol.Dlt,
        //             Protocol.SomeIp,
        //             Protocol.Text,
        //         ].join(', ')}.`,
        //     ),
        // );
        return '';
    }

    public errors(): Error[] {
        return this.error;
    }

    public execute(cli: Service): Promise<void> {
        // if (this.error.length > 0) {
        //     return Promise.reject(
        //         new Error(
        //             `Handler cannot be executed, because errors: \n${this.error
        //                 .map((e) => e.message)
        //                 .join('\n')}`,
        //         ),
        //     );
        // }
        // if (this.parser === undefined) {
        //     return Promise.resolve();
        // }
        // cli.state().parser(this.parser);
        // return Promise.resolve();
        return Promise.reject(new Error(`Not implemented!`));
    }

    public type(): Type {
        return Type.StateModifier;
    }

    public defined(): boolean {
        return false;
        // return this.parser !== undefined;
    }
}
