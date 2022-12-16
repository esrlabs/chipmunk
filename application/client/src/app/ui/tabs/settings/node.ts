import { ISettingsEntry } from '@platform/types/settings/entry';

export class Node {
    public readonly entries: ISettingsEntry[] = [];
    public readonly childs: Node[] = [];
    public readonly path: string;

    constructor(path: string) {
        this.path = path;
    }

    public attach(entry: ISettingsEntry): boolean {
        if (this.path === entry.desc.path) {
            this.entries.push(entry);
            return true;
        }
        for (const child of this.childs) {
            if (child.attach(entry)) {
                return true;
            }
        }
        return false;
    }

    public adopt(path: string): boolean {
        if (this.path === path) {
            return true;
        }
        const parts = path.split('.');
        if (parts.length === 0) {
            return false;
        }
        const childPath = `${this.path}${this.path === '' ? '' : '.'}${parts[0]}`;
        let child = this.child(childPath);
        if (child === undefined) {
            child = new Node(childPath);
            this.childs.push(child);
        }
        parts.splice(0, 1);
        if (parts.length === 0) {
            return true;
        }
        return child.adopt(parts.join('.'));
    }

    public child(path: string): Node | undefined {
        return this.childs.find((c) => c.path === path);
    }

    public isRoot(): boolean {
        return this.path === '';
    }
}
