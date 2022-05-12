import { components } from '@env/decorators/initial';
import { RecentAction } from '../recent';
import { IComponentDesc } from '@ui/elements/containers/dynamic/component';

import * as Files from './file/index';

export class Recent extends RecentAction {
    public text: Files.Text | undefined;
    public dlt: Files.Dlt | undefined;
    public pcap: Files.Pcap | undefined;

    public apply(): Promise<void> {
        return Promise.resolve();
    }
    public asComponent(): IComponentDesc {
        return {
            factory: components.get('app-recent-file'),
            inputs: {},
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
    public asJSON(): string {
        return '';
    }
    public fromJSON(str: string): Error | undefined {
        return undefined;
    }
}
