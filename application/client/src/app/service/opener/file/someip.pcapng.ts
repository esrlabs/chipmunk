import { FileOpener } from '../file';
import { Render } from '@schema/render/index';
import { getRenderFor } from '@schema/render/tools';
import { ISomeIpOptions } from '@platform/types/parsers/someip';

export class SomeIpInPcap extends FileOpener<ISomeIpOptions, { someip: ISomeIpOptions }> {
    public getRender(): Render<unknown> {
        return getRenderFor().dlt();
    }
    public getSettings():
        | {
              name: string;
              component: string;
          }
        | undefined {
        return {
            name: 'Opening PcapNG file with SomeIp',
            component: 'app-tabs-source-pcapfile',
        };
        // TODO: create component >>>>>>>>>>>>>>>>>>>>>>
    }
    public getNamedOptions(options: ISomeIpOptions): { someip: ISomeIpOptions } {
        return { someip: options };
    }
}
