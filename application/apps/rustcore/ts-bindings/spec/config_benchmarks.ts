import * as fs from 'fs';
import * as path from 'path';
import { readConfigFile } from './common';

export interface IPerformanceTest {
    open_as: 'text' | 'dlt' | 'pcapng' | '';
    ignore: boolean;
    alias: string;
    expectation_ms: number;
    file: string;
}

export interface IConfiguration {
    log_level: number;
    tests: {
        benchmark: {
            performance: {
                tests: { [key: string]: IPerformanceTest };
            };
        };
    };
}

export function readBenchmarkConfigurationFile(): Config {
    const config = readConfigFile<IConfiguration>('JASMIN_TEST_CONFIGURATION', [
        path.resolve(path.dirname(module.filename), 'benchmarks.json'),
        path.resolve(path.dirname(module.filename), '../../benchmarks.json'),
    ]);

    if (config instanceof Error) {
        console.warn(`\n`);
        console.warn(`=`.repeat(81));
        console.warn(`**** ERROR ${'*'.repeat(68)}`);
        console.warn(`=`.repeat(81));
        console.warn(`Fail to read configuration file due error: ${config.message}`);
        console.warn(
            `Test will be done in the scope of tasks, which do not require configuration.`,
        );
        console.warn(`=`.repeat(81));
        console.warn(`\n`);
        process.exit(1);
    } else {
        return new Config(config);
    }
}

export class Config {
    private readonly _config: IConfiguration;

    constructor(config: IConfiguration) {
        this._config = config;
    }

    public get(): IConfiguration {
        return this._config;
    }
}
