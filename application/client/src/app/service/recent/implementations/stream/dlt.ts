import { components } from '@env/decorators/initial';
import { RecentAction } from '../recent';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { IDLTOptions } from '@platform/types/parsers/dlt';
import { SourceDefinition } from '@platform/types/transport';

import * as obj from '@platform/env/obj';

export class Recent extends RecentAction {
    public source!: SourceDefinition;
    public options!: IDLTOptions;

    public asComponent(): IComponentDesc {
        return {
            factory: components.get('app-recent-stream'),
            inputs: {
                source: this.source,
                parser: {
                    dlt: this.options,
                },
            },
        };
    }
    public description(): {
        major: string;
        minor: string;
    } {
        if (this.source.udp !== undefined) {
            return {
                major: `DLT on UPD: ${this.source.udp.bind_addr}`,
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
        }
        return {
            major: '---- not implemented ----',
            minor: '---- not implemented ----',
        };
    }
    public asObj(): { [key: string]: unknown } {
        return {
            source: this.source,
            options: this.options,
        };
    }

    public from(inputs: { [key: string]: unknown }): Recent {
        if (typeof inputs !== 'object') {
            throw new Error(
                `Expected format of recent file-action is an object. Actual type: ${typeof inputs}`,
            );
        }
        this.source = obj.getAsObj(inputs, 'source');
        this.options = obj.getAsObj(inputs, 'options');
        return this;
    }
}
