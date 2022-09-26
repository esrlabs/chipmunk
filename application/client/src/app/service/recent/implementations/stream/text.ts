import { components } from '@env/decorators/initial';
import { RecentAction } from '../recent';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { SourceDefinition } from '@platform/types/transport';

import * as obj from '@platform/env/obj';

export class Recent extends RecentAction {
    public source!: SourceDefinition;

    public asComponent(): IComponentDesc {
        return {
            factory: components.get('app-recent-stream'),
            inputs: {
                source: this.source,
                parser: {},
            },
        };
    }
    public description(): {
        major: string;
        minor: string;
    } {
        if (this.source.udp !== undefined) {
            return {
                major: `Plain text on UPD: ${this.source.udp.bind_addr}`,
                minor:
                    this.source.udp.multicast.length === 0
                        ? ''
                        : `multicast: ${this.source.udp.multicast
                              .map(
                                  (m) =>
                                      `${m.multiaddr}${
                                          m.interface !== undefined ? `(${m.interface})` : ''
                                      }`,
                              )
                              .join(', ')}`,
            };
        } else if (this.source.process !== undefined) {
            return {
                major: `Plain text from STDOUT/ERR`,
                minor: `${this.source.process.command} ${this.source.process.args.join(' ')}`,
            };
        } else if (this.source.tcp !== undefined) {
            return {
                major: `Plain text on TCP: ${this.source.tcp.bind_addr}`,
                minor: '',
            };
        } else if (this.source.serial !== undefined) {
            return {
                major: `Plain text on Serial: ${this.source.serial.path}`,
                minor: `baudrate: ${this.source.serial.baud_rate}, data bits: ${this.source.serial.data_bits}, flow control: ${this.source.serial.flow_control}, parity: ${this.source.serial.parity}, stop bits: ${this.source.serial.stop_bits}`,
            };
        } else {
            return {
                major: '',
                minor: '',
            };
        }
    }
    public asObj(): { [key: string]: unknown } {
        return {
            source: this.source,
        };
    }

    public from(inputs: { [key: string]: unknown }): Recent {
        if (typeof inputs !== 'object') {
            throw new Error(
                `Expected format of recent file-action is an object. Actual type: ${typeof inputs}`,
            );
        }
        this.source = obj.getAsObj(inputs, 'source');
        return this;
    }
}
