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
<<<<<<<< HEAD:application/client/src/app/service/opener/file/dlt.pcapng.ts
            name: 'Opening PcapNG file with DLT',
========
            name: 'Opening PCAP file with DLT',
>>>>>>>> 7a111dd8e (Refactoring rest levels):application/client/src/app/service/opener/file/dlt.pcap.ts
            component: 'app-tabs-source-pcapfile',
        };
    }
    public getNamedOptions(options: IDLTOptions): { dlt: IDLTOptions } {
        return { dlt: options };
    }
}
