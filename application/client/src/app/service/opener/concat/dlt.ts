import { FileOpener } from '../concat';
import { Render } from '@schema/render/index';
import { getRenderFor } from '@schema/render/tools';
import { IDLTOptions } from '@platform/types/parsers/dlt';

export class Dlt extends FileOpener<IDLTOptions, { dlt: IDLTOptions }> {
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
            name: 'Opening DLT file',
            component: 'app-tabs-source-dltfile',
        };
    }
    public getNamedOptions(options: IDLTOptions): { dlt: IDLTOptions } {
        return { dlt: options };
    }
}
