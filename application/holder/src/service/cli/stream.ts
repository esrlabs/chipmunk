import { CLIAction, Type } from './action';
import { Service } from '@service/cli';

import * as Requests from 'platform/ipc/request';

// function serial(settings: string): $.Origin.Stream.Stream.Serial.IConfiguration | Error {
//     settings = settings.replace(/\s/gi, '');
//     const parts = settings.split(';');
//     if (parts.length !== 6) {
//         return new Error(
//             `Expecting definition for path; baud_rate; data_bits; flow_control; parity; stop_bits. Use -h (--help) for more details`,
//         );
//     }
//     let error: Error | undefined;
//     const parameters: $.Origin.Stream.Stream.Serial.IConfiguration = {
//         path: '',
//         baud_rate: -1,
//         data_bits: -1,
//         flow_control: -1,
//         parity: -1,
//         stop_bits: -1,
//         send_data_delay: -1,
//         exclusive: true,
//     };
//     const keys = [
//         'path',
//         'baud_rate',
//         'data_bits',
//         'flow_control',
//         'parity',
//         'stop_bits',
//         'send_data_delay',
//         'exclusive',
//     ];
//     parts.forEach((p, i) => {
//         if (error instanceof Error) {
//             return;
//         }
//         if (i === 0 && p.trim().length === 0) {
//             error = new Error(`Path has invalid value.`);
//             return;
//         }
//         if (i === 0) {
//             (parameters as unknown as { [key: string]: string | number | boolean })[keys[i]] = p;
//         } else if (i === keys.length - 1) {
//             (parameters as unknown as { [key: string]: string | number | boolean })[keys[i]] =
//                 typeof p === 'boolean'
//                     ? p
//                     : typeof p === 'string'
//                     ? p === 'true'
//                         ? true
//                         : false
//                     : typeof p === 'number'
//                     ? p === 1
//                         ? true
//                         : false
//                     : true;
//         } else {
//             const value = parseInt(p, 10);
//             if (isNaN(value) || !isFinite(value)) {
//                 error = new Error(`Parameter "${keys[i]}" has invalid value.`);
//                 return;
//             }
//             (parameters as unknown as { [key: string]: string | number })[keys[i]] = value;
//         }
//     });
//     if (error instanceof Error) {
//         return error;
//     }
//     return parameters;
// }

// function udp(settings: string): $.Origin.Stream.Stream.UDP.IConfiguration | Error {
//     settings = settings.replace(/\s/gi, '');
//     const parts = settings.split('|');
//     if (parts.length !== 2) {
//         return new Error(
//             `Expecting definition for addr and multicast splitted with "|". Use -h (--help) for more details`,
//         );
//     }
//     if (parts[0].length === 0) {
//         return new Error(`Fail to find addr to connect. Use -h (--help) for more details`);
//     }
//     if (parts[1].length === 0) {
//         return new Error(`Fail to find multicast defenitions. Use -h (--help) for more details`);
//     }
//     let error: Error | undefined;
//     const multicast = parts[1]
//         .split(';')
//         .map((pair) => {
//             if (pair.trim().length === 0) {
//                 return undefined;
//             }
//             if (error !== undefined) {
//                 return {
//                     multiaddr: '',
//                     interface: undefined,
//                 };
//             }
//             const pairs = pair.split(',');
//             if (pairs.length !== 1 && pairs.length !== 2) {
//                 error = new Error(
//                     `Each multicast defenition should include address and interface (or at least mutlicast address). Use -h (--help) for more details `,
//                 );
//             }
//             if (pairs.length === 1 && pairs[0].length === 0) {
//                 error = new Error(
//                     `Each multicast defenition should include at least address. Use -h (--help) for more details `,
//                 );
//             }
//             if (pairs.length === 2 && pairs[0].length === 0 && pairs[1].length === 0) {
//                 error = new Error(
//                     `Each multicast defenition should include address and interface. Use -h (--help) for more details `,
//                 );
//             }
//             return {
//                 multiaddr: pairs[0],
//                 interface: pairs.length === 1 ? undefined : pairs[1],
//             };
//         })
//         .filter(
//             (m: $.Origin.Stream.Stream.UDP.Multicast | undefined) => m !== undefined,
//         ) as $.Origin.Stream.Stream.UDP.Multicast[];
//     if (error instanceof Error) {
//         return error;
//     }
//     return {
//         bind_addr: parts[0],
//         multicast,
//     };
// }

// function getObserveFactory(
//     target: string | undefined,
//     cwd: string,
//     arg: string,
// ): Factory.Stream | Error {
//     if (target === 'stdout') {
//         if (arg.trim() !== '') {
//             return new Factory.Stream().process({
//                 command: arg,
//                 cwd,
//                 envs: {},
//             });
//         } else {
//             return new Error(`Command to spawn cannot be empty`);
//         }
//     } else if (target === 'serial') {
//         const settings = serial(arg);
//         if (settings instanceof Error) {
//             return settings;
//         } else {
//             return new Factory.Stream().serial(settings);
//         }
//     } else if (target === 'tcp') {
//         if (arg.trim() !== '') {
//             return new Factory.Stream().tcp({ bind_addr: arg });
//         } else {
//             return new Error(`No bidning address for TCP connection`);
//         }
//     } else if (target === 'udp') {
//         const settings = udp(arg);
//         if (settings instanceof Error) {
//             return settings;
//         } else {
//             return new Factory.Stream().udp(settings);
//         }
//     }
//     return new Error(`Unknown target for streaming: ${target}`);
// }

export class Action extends CLIAction {
    // protected factories: Factory.Stream[] = [];
    protected error: Error[] = [];

    public argument(target: string | undefined, cwd: string, arg: string): string {
        // const factory = getObserveFactory(target, cwd, arg);
        // if (factory instanceof Error) {
        //     this.error.push(factory);
        //     return '';
        // }
        // this.factories.push(factory);
        return arg;
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
        if (!this.defined()) {
            return Promise.resolve();
        }
        return Promise.reject(new Error(`Not implemented!`));
        // return new Promise((resolve, _reject) => {
        //     Requests.IpcRequest.send(
        //         Requests.Cli.Observe.Response,
        //         new Requests.Cli.Observe.Request({
        //             observe: this.factories.map((factory) =>
        //                 factory.protocol(cli.state().parser()).get().sterilized(),
        //             ),
        //         }),
        //     )
        //         .then((response) => {
        //             if (response.session === undefined) {
        //                 return;
        //             }
        //             cli.state().sessions([response.session]);
        //         })
        //         .catch((err: Error) => {
        //             cli.log().error(`Fail apply stream action: ${err.message}`);
        //         })
        //         .finally(resolve);
        // });
    }

    public type(): Type {
        return Type.Action;
    }

    public defined(): boolean {
        return false;
        // return this.factories.length > 0;
    }
}
