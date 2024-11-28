import * as fs from 'fs';
import * as path from 'path';
import { readConfigFile } from './common';

export interface ICancelTestSpec {
    terms: string[];
    interval_ms: number;
    timeout_last_search_ms: number;
    filesize: number;
    datasetLength: number;
}

export interface IMapTestSpec {
    filesize: number;
    datasetLength: number;
}

export interface IRegularTests {
    execute_only: number[];
    list: { [key: string]: string };
    files: { [key: string]: string };
    spec?: {
        cancel?: { [key: string]: ICancelTestSpec };
        map?: { [key: string]: IMapTestSpec };
    };
}

export interface IConfiguration {
    log_level: number;
    tests: {
        observe: {
            regular: IRegularTests;
        };
        protocol: {
            regular: IRegularTests;
        };
        stream: {
            regular: IRegularTests;
        };
        indexes: {
            regular: IRegularTests;
        };
        jobs: {
            regular: IRegularTests;
        };
        concat: {
            regular: IRegularTests;
        };
        search: {
            regular: IRegularTests;
        };
        values: {
            regular: IRegularTests;
        };
        ranges: {
            regular: IRegularTests;
        };
        extract: {
            regular: IRegularTests;
        };
        exporting: {
            regular: IRegularTests;
        };
        cancel: {
            regular: IRegularTests;
        };
        errors: {
            regular: IRegularTests;
        };
        map: {
            regular: IRegularTests;
        };
        promises: {
            regular: IRegularTests;
        };
        observing: {
            regular: IRegularTests;
        };
    };
}

export function readConfigurationFile(): Config {
    const config = readConfigFile<IConfiguration>('JASMIN_TEST_CONFIGURATION', [
        path.resolve(path.dirname(module.filename), 'defaults.json'),
        path.resolve(path.dirname(module.filename), '../../defaults.json'),
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
