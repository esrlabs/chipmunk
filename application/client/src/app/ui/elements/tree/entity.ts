import { Entity as IEntity, EntityType } from '@platform/types/files';

export class Entity {
    public entity: IEntity;
    public parent: string;

    constructor(entity: IEntity, parent: string) {
        this.entity = entity;
        this.parent = parent;
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
