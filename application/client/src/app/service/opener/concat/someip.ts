import { FileOpener } from '../concat';
import { Render } from '@schema/render/index';
import { getRenderFor } from '@schema/render/tools';
import { ISomeIpOptions } from '@platform/types/parsers/someip';

export class SomeIp extends FileOpener<ISomeIpOptions, { someip: ISomeIpOptions }> {
    public getRender(): Render<unknown> {
        return getRenderFor().someip();
    }
    public getSettings():
        | {
              name: string;
              component: string;
          }
        | undefined {
        return {
            name: 'Opening SomeIp file',
            component: 'app-tabs-source-pcapfile',
        };
        // TODO: create component >>>>>>>>>>>>>>>>>>>>>>
    }
    public getNamedOptions(options: ISomeIpOptions): { someip: ISomeIpOptions } {
        return { someip: options };
    }
}
