import { FileOpener } from '../file';
import { Render } from '@schema/render/index';
import { getRenderFor } from '@schema/render/tools';
import { IDLTOptions } from '@platform/types/parsers/dlt';

export class DltInPcap extends FileOpener<IDLTOptions, { dlt: IDLTOptions }> {
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
            name: 'Opening PcapNG file with DLT',
            component: 'app-tabs-source-pcapfile',
        };
    }
    public getNamedOptions(options: IDLTOptions): { dlt: IDLTOptions } {
        return { dlt: options };
    }
}
