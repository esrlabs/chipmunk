import { components } from '@env/decorators/initial';
import { RecentAction } from '../recent';
import { IComponentDesc } from '@ui/elements/containers/dynamic/component';
import { unique } from '@platform/env/sequence';

import * as Files from './index';
import * as obj from '@platform/env/obj';

export class Recent extends RecentAction {
    public text: Files.Text | undefined;
    public dlt: Files.Dlt | undefined;
    public pcap: Files.Pcap | undefined;

    public asComponent(): IComponentDesc {
        return {
            factory: components.get('app-recent-file'),
            inputs: {
                text: this.text,
                dlt: this.dlt,
                pcap: this.pcap,
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
        if (this.text !== undefined) {
            return this.text.asObj();
        } else if (this.dlt !== undefined) {
            return this.dlt.asObj();
        } else if (this.pcap !== undefined) {
            return this.pcap.asObj();
        } else {
            throw new Error(`No any file type defined`);
        }
    }

    public from(inputs: { [key: string]: unknown }): Recent {
        if (typeof inputs !== 'object') {
            throw new Error(
                `Expected format of recent file-action is an object. Actual type: ${typeof inputs}`,
            );
        }
        if (inputs['dlt'] !== undefined) {
            this.dlt = new Files.Dlt(inputs);
        } else if (inputs['pcap'] !== undefined) {
            this.pcap = new Files.Pcap(inputs);
        } else {
            this.text = new Files.Text(inputs);
        }
        return this;
    }
}
