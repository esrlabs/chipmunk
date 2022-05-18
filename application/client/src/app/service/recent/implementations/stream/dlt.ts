import { components } from '@env/decorators/initial';
import { RecentAction } from '../recent';
import { IComponentDesc } from '@ui/elements/containers/dynamic/component';
import { unique } from '@platform/env/sequence';
import { IDLTOptions } from '@platform/types/parsers/dlt';
import { SourceDefinition } from '@platform/types/transport';

import * as obj from '@platform/env/obj';

export class Recent extends RecentAction {
    public source: SourceDefinition | undefined;
    public options: IDLTOptions | undefined;

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
        short: string;
        full: string;
    } {
        return {
            short: '',
            full: '',
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
