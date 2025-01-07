import { CancelablePromise } from 'platform/env/promise';
import { Base, Cancelled, decode } from '../native/native.jobs';
import { error } from 'platform/log/utils';
import { IFilter } from 'platform/types/filter';
import { SomeipStatistic } from 'platform/types/observe/parser/someip';
import {
    FoldersScanningResult,
    DltStatisticInfo,
    Profile,
    ProfileList,
    MapKeyValue,
} from 'platform/types/bindings';
import { PluginEntity } from 'platform/types/plugins';

import * as protocol from 'protocol';

export class Jobs extends Base {
    public static async create(): Promise<Jobs> {
        const instance = new Jobs();
        await instance.init();
        return instance;
    }

    // This method is used for testing
    public cancelTest(num_a: number, num_b: number, seq?: number): CancelablePromise<number> {
        const sequence = seq === undefined ? this.sequence() : seq;
        const job: CancelablePromise<number> = this.execute(
            // We should define validation callback. As argument it takes result of job,
            // which should be checked for type. In case it type is correct, callback
            // should return true
            (buf: Uint8Array): number | Error => {
                return decode<number>(buf, protocol.decodeCommandOutcomeWithi64);
            },
            // As second argument of executor we should provide native function of job.
            this.native.jobCancelTest(sequence, num_a, num_b),
            // Sequence of job
            sequence,
            // Alias of job for logs
            'cancelTest',
        );
        return job;
    }

    public listContent(options: {
        depth: number;
        max: number;
        paths: string[];
        include: { files: boolean; folders: boolean };
    }): CancelablePromise<FoldersScanningResult> {
        const sequence = this.sequence();
        const job: CancelablePromise<FoldersScanningResult> = this.execute(
            (buf: Uint8Array): any | Error => {
                const output = decode<FoldersScanningResult>(
                    buf,
                    protocol.decodeCommandOutcomeWithFoldersScanningResult,
                );
                if (output instanceof Error || output instanceof Cancelled) {
                    return output;
                } else {
                    return output;
                }
            },
            this.native.listFolderContent(
                sequence,
                options.depth,
                options.max,
                options.paths,
                options.include.files,
                options.include.folders,
            ),
            sequence,
            'listContent',
        );
        return job;
    }

    public isFileBinary(options: { filePath: string }): CancelablePromise<boolean> {
        const sequence = this.sequence();
        const job: CancelablePromise<boolean> = this.execute(
            (buf: Uint8Array): boolean | Error => {
                return decode<boolean>(buf, protocol.decodeCommandOutcomeWithbool);
            },
            this.native.isFileBinary(sequence, options.filePath),
            sequence,
            'isFileBinary',
        );
        return job;
    }

    public spawnProcess(path: string, args: string[]): CancelablePromise<void> {
        const sequence = this.sequence();
        const job: CancelablePromise<void> = this.execute(
            (buf: Uint8Array): void | Error => {
                return decode<void>(buf, protocol.decodeCommandOutcomeWithVoid);
            },
            this.native.spawnProcess(sequence, path, args),
            sequence,
            'spawnProcess',
        );
        return job;
    }

    public getFileChecksum(path: string): CancelablePromise<string> {
        const sequence = this.sequence();
        const job: CancelablePromise<string> = this.execute(
            (buf: Uint8Array): string | Error => {
                return decode<string>(buf, protocol.decodeCommandOutcomeWithString);
            },
            this.native.getFileChecksum(sequence, path),
            sequence,
            'getFileChecksum',
        );
        return job;
    }

    public getDltStats(paths: string[]): CancelablePromise<DltStatisticInfo> {
        const sequence = this.sequence();
        const job: CancelablePromise<DltStatisticInfo> = this.execute(
            (buf: Uint8Array): any | Error => {
                const decoded = decode<DltStatisticInfo>(
                    buf,
                    protocol.decodeCommandOutcomeWithDltStatisticInfo,
                );
                if (decoded instanceof Error) {
                    return decoded;
                }
                return decoded;
            },
            this.native.getDltStats(sequence, paths),
            sequence,
            'getDltStats',
        );
        return job;
    }

    public getSomeipStatistic(paths: string[]): CancelablePromise<SomeipStatistic> {
        const sequence = this.sequence();
        const job: CancelablePromise<SomeipStatistic> = this.execute(
            (buf: Uint8Array): any | Error => {
                const decoded = decode<string>(buf, protocol.decodeCommandOutcomeWithString);
                if (decoded instanceof Error) {
                    return decoded;
                }
                try {
                    return JSON.parse(decoded) as SomeipStatistic;
                } catch (e) {
                    return new Error(error(e));
                }
            },
            this.native.getSomeipStatistic(sequence, paths),
            sequence,
            'getSomeipStatistic',
        );
        return job;
    }

    public getShellProfiles(): CancelablePromise<Profile[]> {
        const sequence = this.sequence();
        const job: CancelablePromise<Profile[]> = this.execute(
            (buf: Uint8Array): any | Error => {
                const decoded = decode<ProfileList>(buf, protocol.decodeCommandOutcomeWithString);
                return decoded;
            },
            this.native.getShellProfiles(sequence),
            sequence,
            'getShellProfiles',
        );
        return job;
    }

    public getContextEnvvars(): CancelablePromise<Map<string, string>> {
        const sequence = this.sequence();
        const job: CancelablePromise<Map<string, string>> = this.execute(
            (buf: Uint8Array): Map<string, string> | Error => {
                const decoded = decode<MapKeyValue>(
                    buf,
                    protocol.decodeCommandOutcomeWithMapKeyValue,
                );
                return decoded;
            },
            this.native.getContextEnvvars(sequence),
            sequence,
            'getContextEnvvars',
        );
        return job;
    }

    public getSerialPortsList(): CancelablePromise<string[]> {
        const sequence = this.sequence();
        const job: CancelablePromise<string[]> = this.execute(
            (buf: Uint8Array): string[] | Error => {
                return decode<string[]>(buf, protocol.decodeCommandOutcomeWithSerialPortsList);
            },
            this.native.getSerialPortsList(sequence),
            sequence,
            'getSerialPortsList',
        );
        return job;
    }

    public getRegexError(filter: IFilter): CancelablePromise<string | undefined> {
        const sequence = this.sequence();
        const job: CancelablePromise<string | undefined> = this.execute(
            (buf: Uint8Array): any | Error => {
                const decoded = decode<string | undefined>(
                    buf,
                    protocol.decodeCommandOutcomeWithOptionString,
                );
                if (decoded instanceof Error) {
                    return decoded;
                } else if (typeof decoded === 'string' && decoded.trim() !== '') {
                    return decoded;
                } else {
                    return undefined;
                }
            },
            this.native.getRegexError(sequence, {
                value: filter.filter,
                is_regex: filter.flags.reg,
                ignore_case: !filter.flags.cases,
                is_word: filter.flags.word,
            }),
            sequence,
            'getRegexError',
        );
        return job;
    }

    public sleep(ms: number): CancelablePromise<undefined> {
        const sequence = this.sequence();
        const job: CancelablePromise<undefined> = this.execute(
            (buf: Uint8Array): any | Error => {
                return decode<void>(buf, protocol.decodeCommandOutcomeWithVoid);
            },
            this.native.sleep(sequence, ms),
            sequence,
            'sleep',
        );
        return job;
    }

    public getAllPlugins(): CancelablePromise<PluginEntity[]> {
        const sequence = this.sequence();
        const job: CancelablePromise<PluginEntity[]> = this.execute(
            (pluginsJson: string): PluginEntity[] | Error => {
                try {
                    return JSON.parse(pluginsJson);
                } catch (e) {
                    return new Error(error(e));
                }
            },
            this.native.getAllPlugins(sequence),
            sequence,
            'getAllPlugins',
        );
        return job;
    }

    public getActivePlugins(): CancelablePromise<PluginEntity[]> {
        const sequence = this.sequence();
        const job: CancelablePromise<PluginEntity[]> = this.execute(
            (pluginsJson: string): PluginEntity[] | Error => {
                try {
                    return JSON.parse(pluginsJson);
                } catch (e) {
                    return new Error(error(e));
                }
            },
            this.native.getActivePlugins(sequence),
            sequence,
            'getActivePlugins',
        );
        return job;
    }

    public reloadPlugins(): CancelablePromise<void> {
        const sequence = this.sequence();
        const job: CancelablePromise<void> = this.execute(
            (): void => {},
            this.native.reloadPlugins(sequence),
            sequence,
            'reloadPlugins',
        );
        return job;
    }
}
