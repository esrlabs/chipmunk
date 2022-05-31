import { Entity as IEntity, EntityType } from '@platform/types/files';

const ICONS: { [key: string]: string[] } = {
    description: ['.txt', '.log', '.logs', '.info', '.cfg', '.json'],
    bug_report: ['.dlt'],
    cell_tower: ['.pcap', '.ngpcap'],
};

const CACHE: Map<string, string> = new Map();

export class Entity {
    public readonly entity: IEntity;
    public readonly parent: string;
    public icon: string | undefined;

    constructor(entity: IEntity, parent: string) {
        this.entity = entity;
        this.parent = parent;
        if (entity.details !== undefined) {
            const ext = entity.details.ext.toLowerCase();
            const icon = CACHE.get(ext);
            if (icon !== undefined) {
                this.icon = icon;
            } else {
                Object.keys(ICONS).forEach((icon) => {
                    if (this.icon !== undefined) {
                        return;
                    }
                    if (ICONS[icon].indexOf(ext) !== -1) {
                        this.icon = icon;
                        CACHE.set(ext, icon);
                    }
                });
            }
        }
    }

    public getPath(): string {
        return `${this.parent}/${this.entity.name}`;
    }

    public isFolder(): boolean {
        return this.entity.type === EntityType.Directory;
    }

    public getName(): string {
        return this.entity.name;
    }
}
