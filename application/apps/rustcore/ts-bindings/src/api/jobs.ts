import { CancelablePromise } from 'platform/env/promise';
import { Base, decode } from '../native/native.jobs';
import { error } from 'platform/log/utils';
import { IFilter } from 'platform/types/filter';
import { ShellProfile } from 'platform/types/shells';
import { SomeipStatistic } from 'platform/types/observe/parser/someip';
import { StatisticInfo } from 'platform/types/observe/parser/dlt';

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
    }): CancelablePromise<string> {
        const sequence = this.sequence();
        const job: CancelablePromise<string> = this.execute(
            (buf: Uint8Array): any | Error => {
                // TODO: Add type declaration!
                return decode(buf, protocol.decodeCommandOutcomeWithFoldersScanningResult);
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
            (buf: Uint8Array): any | Error => {
                return decode(buf, protocol.decodeCommandOutcomeWithbool);
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
            (buf: Uint8Array): any | Error => {
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
            (buf: Uint8Array): any | Error => {
                return decode<string>(buf, protocol.decodeCommandOutcomeWithString);
            },
            this.native.getFileChecksum(sequence, path),
            sequence,
            'getFileChecksum',
        );
        return job;
    }

    public getDltStats(paths: string[]): CancelablePromise<StatisticInfo> {
        const sequence = this.sequence();
        const job: CancelablePromise<StatisticInfo> = this.execute(
            (buf: Uint8Array): any | Error => {
                const decoded = decode<string>(buf, protocol.decodeCommandOutcomeWithString);
                if (decoded instanceof Error) {
                    return decoded;
                }
                try {
                    return JSON.parse(decoded) as StatisticInfo;
                } catch (e) {
                    return new Error(error(e));
                }
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

    public getShellProfiles(): CancelablePromise<ShellProfile[]> {
        const sequence = this.sequence();
        const job: CancelablePromise<ShellProfile[]> = this.execute(
            (buf: Uint8Array): any | Error => {
                const decoded = decode<string>(buf, protocol.decodeCommandOutcomeWithString);
                if (decoded instanceof Error) {
                    return decoded;
                }
                try {
                    const unparsed: unknown[] = JSON.parse(decoded);
                    const profiles: ShellProfile[] = [];
                    unparsed.forEach((unparsed: unknown) => {
                        const profile = ShellProfile.fromObj(unparsed);
                        if (!(profile instanceof Error)) {
                            profiles.push(profile);
                        }
                    });
                    return profiles;
                } catch (e) {
                    return new Error(error(e));
                }
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
                const decoded = decode<string>(buf, protocol.decodeCommandOutcomeWithString);
                if (decoded instanceof Error) {
                    return decoded;
                }
                try {
                    const unparsed: { [key: string]: string } = JSON.parse(decoded);
                    const envvars: Map<string, string> = new Map();
                    if (
                        unparsed === undefined ||
                        unparsed === null ||
                        typeof unparsed !== 'object'
                    ) {
                        return new Error(`Fail to parse envvars string: ${unparsed}`);
                    }
                    Object.keys(unparsed).forEach((key) => {
                        envvars.set(key, unparsed[key]);
                    });
                    return envvars;
                } catch (e) {
                    return new Error(error(e));
                }
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
}
