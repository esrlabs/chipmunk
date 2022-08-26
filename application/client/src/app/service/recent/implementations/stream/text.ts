import { components } from '@env/decorators/initial';
import { RecentAction } from '../recent';
import { IComponentDesc } from '@ui/elements/containers/dynamic/component';
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
        }
        return {
            major: '---- not implemented ----',
            minor: '---- not implemented ----',
        };
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
