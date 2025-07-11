import { Subject } from '@platform/env/subscription';
import { unique } from '@platform/env/sequence';
import { getFileName } from '@platform/types/files';
import { ObserveOperation } from './stream';

export interface IInfoBlock {
    caption: string;
    tooltip: string;
    icon?: string;
}

export class Info {
    protected readonly blocks: Map<string, IInfoBlock> = new Map();

    public updated: Subject<void> = new Subject();

    public destroy(): void {
        this.updated.destroy();
    }

    public fromOperation(operation: ObserveOperation) {
        // TODO (Not implemented. API required):
        //
        // Purpose of this service
        //
        // When a session is created, auxiliary information may be displayed in the bottom toolbar.
        // For example, for DLT and SomeIP files (or TCP/UDP connections), this could be information
        // about the associated FIBEX file.
        //
        // In the previous version, the client had knowledge about the used parser/source,
        // so this information was generated directly on the client side.
        //
        // Due to the updated paradigm, where the client "knows nothing" about the parsers
        // and sources being used, an additional API on the rustcore side is required.
        // This API provides the "messages" that need to be displayed in the toolbar.
        //
        // Currently, this functionality is disabled.
        console.warn(`API for toolbar notes is not implemented yet`);
    }

    public add(block: IInfoBlock, uuid?: string): string {
        uuid = uuid === undefined ? unique() : uuid;
        this.blocks.set(uuid, block);
        this.updated.emit();
        return uuid;
    }

    public update(uuid: string, block: IInfoBlock): void {
        this.blocks.set(uuid, block);
        this.updated.emit();
    }

    public remove(uuid: string): void {
        this.blocks.delete(uuid);
        this.updated.emit();
    }

    public get(): IInfoBlock[] {
        return Array.from(this.blocks.values());
    }
}
