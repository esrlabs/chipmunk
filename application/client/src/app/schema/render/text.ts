import { Render } from './index';
import { Protocol } from '@platform/types/observe/parser/index';

export class TextRender extends Render<void> {
    public override protocol(): Protocol {
        return Protocol.Text;
    }
}
