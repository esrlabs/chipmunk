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
        const uuid = operation.uuid;
        console.error(`Not Implemented`);
        // if (observe.configuration.parser[Protocol.Dlt] !== undefined) {
        //     const cfg = observe.configuration.parser[Protocol.Dlt];
        //     if (cfg.fibex_file_paths !== undefined) {
        //         if (cfg.fibex_file_paths.length === 1) {
        //             this.add(
        //                 {
        //                     caption: `FIBEX: ${getFileName(cfg.fibex_file_paths[0])}`,
        //                     tooltip: `Used FIBEX: ${cfg.fibex_file_paths[0]}`,
        //                 },
        //                 `fibex_${uuid}`,
        //             );
        //         } else if (cfg.fibex_file_paths.length > 1) {
        //             this.add(
        //                 {
        //                     caption: `FIBEX: ${cfg.fibex_file_paths.length} files`,
        //                     tooltip: cfg.fibex_file_paths.join('\n'),
        //                 },
        //                 `fibex_${uuid}`,
        //             );
        //         }
        //     }
        //     if (cfg.tz !== undefined) {
        //         this.add(
        //             {
        //                 caption: `TZ: ${cfg.tz}`,
        //                 tooltip: `Used TimeZone: ${cfg.tz}`,
        //             },
        //             `tz_${uuid}`,
        //         );
        //     }
        // } else if (observe.configuration.parser[Protocol.SomeIp] !== undefined) {
        //     const cfg = observe.configuration.parser[Protocol.SomeIp];
        //     if (cfg.fibex_file_paths !== undefined) {
        //         if (cfg.fibex_file_paths.length === 1) {
        //             this.add(
        //                 {
        //                     caption: `FIBEX: ${getFileName(cfg.fibex_file_paths[0])}`,
        //                     tooltip: `Used FIBEX: ${cfg.fibex_file_paths[0]}`,
        //                 },
        //                 `fibex_${uuid}`,
        //             );
        //         } else if (cfg.fibex_file_paths.length > 1) {
        //             this.add(
        //                 {
        //                     caption: `FIBEX: ${cfg.fibex_file_paths.length} files`,
        //                     tooltip: cfg.fibex_file_paths.join('\n'),
        //                 },
        //                 `fibex_${uuid}`,
        //             );
        //         }
        //     }
        // } else if (observe.configuration.parser[Protocol.Text] !== undefined) {
        //     // ignore
        // }
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
