import { FileOpener } from '../concat';
import { Render } from '@schema/render/index';
import { getRenderFor } from '@schema/render/tools';

export class Text extends FileOpener<void, void> {
    public getRender(): Render<unknown> {
        return getRenderFor().text();
    }
    public getSettings():
        | {
              name: string;
              component: string;
          }
        | undefined {
        return undefined;
    }

    public getNamedOptions(): void {
        return undefined;
    }
}
