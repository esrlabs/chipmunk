import { Node } from './node';
import { ISettingsEntry } from '@platform/types/settings/entry';

export class State {
    public readonly root: Node = new Node('');

    public build(entries: ISettingsEntry[]): void {
        entries.forEach((entry) => {
            if (!this.root.adopt(entry.desc.path)) {
                console.error(`Fail to create node`);
                return;
            }
            if (!this.root.attach(entry)) {
                console.log(`Fail to add entry`);
            }
        });
    }

}
