import { FileOpener } from '../file';
import { Render } from '@schema/render/index';
import { getRenderFor } from '@schema/render/tools';
import { IDLTOptions } from '@platform/types/parsers/dlt';

export class Pcap extends FileOpener<IDLTOptions, { dlt: IDLTOptions }> {
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
            name: 'Opening PCAP file',
            component: 'app-tabs-source-pcapfile',
        };
    }
    public getNamedOptions(options: IDLTOptions): { dlt: IDLTOptions } {
        return { dlt: options };
    }
}
