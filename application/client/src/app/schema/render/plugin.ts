import { Render } from './index';
import { Protocol } from '@platform/types/observe/parser';

//TODO AAZ: Render is a placeholder now and still missing loading the data from the selected plugin.
// Selected Plugin is in the configurations of the tab and the infos can be retrieved
// from plugin manager.
export class Implementation extends Render<void> {
    override protocol(): Protocol {
        return Protocol.Plugin;
    }
}
