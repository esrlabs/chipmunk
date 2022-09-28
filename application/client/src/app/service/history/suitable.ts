import { Collections } from './collections';
import { GroupRelations } from './definition';

export interface SuitableGroup {
    caption?: string;
    rank: number;
    collections: Collections[];
}

export interface SuitableCollections {
    [key: number]: { caption?: string; collections: Collections[] };
}

export class Suitable {
    public suitable: SuitableCollections = {};

    protected collections: string[] = [];

    public asGroups(): SuitableGroup[] {
        const list: SuitableGroup[] = [];
        Object.keys(this.suitable).forEach((key: string | number) => {
            const rank = typeof key === 'string' ? parseInt(key, 10) : key;
            const index = list.findIndex((g) => g.rank === rank);
            if (index === -1) {
                list.push({
                    caption: this.suitable[rank].caption,
                    rank,
                    collections: this.suitable[rank].collections,
                });
            } else {
                list[index].collections = list[index].collections.concat(
                    this.suitable[rank].collections,
                );
            }
        });
        list.sort((a, b) => {
            return a.rank > b.rank ? 1 : -1;
        });
        return list;
    }

    public add(collections: Collections, group: GroupRelations | undefined): boolean {
        if (group === undefined) {
            return false;
        }
        if (this.collections.indexOf(collections.uuid) !== -1) {
            return false;
        } else {
            this.collections.push(collections.uuid);
        }
        if (this.suitable[group.rank] === undefined) {
            this.suitable[group.rank] = { caption: group.caption, collections: [] };
        }
        this.suitable[group.rank].collections.push(collections);
        return true;
    }
}
