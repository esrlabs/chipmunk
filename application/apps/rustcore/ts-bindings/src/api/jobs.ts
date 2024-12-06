import { CancelablePromise } from 'platform/env/promise';
import { Base } from '../native/native.jobs';
import { error } from 'platform/log/utils';
import { IFilter } from 'platform/types/filter';
import { ShellProfile } from 'platform/types/shells';
import { SomeipStatistic } from 'platform/types/observe/parser/someip';
import { StatisticInfo } from 'platform/types/observe/parser/dlt';

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
            (res: number): number | Error => {
                return typeof res === 'number'
                    ? res
                    : new Error(`jobCancelTest should return number type`);
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
            (res: string): any | Error => {
                if (typeof res !== 'string') {
                    return new Error(
                        `[jobs.listContent] Expecting string, but gotten: ${typeof res}`,
                    );
                }
                return res;
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
            (res: boolean): any | Error => {
                if (typeof res !== 'boolean') {
                    return new Error(
                        `[jobs.isFileBinary] Expecting boolean, but got: ${typeof res}`,
                    );
                }
                return res;
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
            undefined,
            this.native.spawnProcess(sequence, path, args),
            sequence,
            'spawnProcess',
        );
        return job;
    }

    public getFileChecksum(path: string): CancelablePromise<string> {
        const sequence = this.sequence();
        const job: CancelablePromise<string> = this.execute(
            (res: string): any | Error => {
                return typeof res === 'string'
                    ? res
                    : new Error(`getFileChecksum should return string type`);
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
            (res: string): StatisticInfo | Error => {
                try {
                    return JSON.parse(res) as StatisticInfo;
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
            (res: string): SomeipStatistic | Error => {
                try {
                    return JSON.parse(res) as SomeipStatistic;
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
            (res: string): ShellProfile[] | Error => {
                try {
                    const unparsed: unknown[] = JSON.parse(res);
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
            (res: string): Map<string, string> | Error => {
                try {
                    const unparsed: { [key: string]: string } = JSON.parse(res);
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
            (res: string[]): any | Error => {
                return res instanceof Array
                    ? res
                    : new Error(`getSerialPortsList should return string[] type`);
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
            (res: string): any | Error => {
                if (typeof res === 'string' && res.trim() !== '') {
                    return res;
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
            (_res: undefined): any | Error => {
                return undefined;
            },
            this.native.sleep(sequence, ms),
            sequence,
            'sleep',
        );
        return job;
    }

    //TODO AAZ: There is no type conversion currently.
    //This first prototype should deliver the json values as string to
    //show them in the UI
    public getAllPlugins(): CancelablePromise<string> {
        const sequence = this.sequence();
        const job: CancelablePromise<string> = this.execute(
            (res: string): string | Error => {
                return typeof res === 'string'
                    ? res
                    : new Error(`getAllPlugins should return string while prototyping`);
            },
            this.native.getAllPlugins(sequence),
            sequence,
            'getAllPlugins',
        );
        return job;
    }

    public getActivePlugins(): CancelablePromise<string> {
        const sequence = this.sequence();
        const job: CancelablePromise<string> = this.execute(
            (res: string): string | Error => {
                return typeof res === 'string'
                    ? res
                    : new Error(`getActivePlugins should return string while prototyping`);
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
            (res: void): void => {},
            this.native.reloadPlugins(sequence),
            sequence,
            'reloadPlugins',
        );
        return job;
    }
}
