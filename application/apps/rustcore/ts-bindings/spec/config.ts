import * as fs from 'fs';
import * as path from 'path';

export interface IPerformanceTest {
    open_as: 'text' | 'dlt' | 'pcap';
    ignore: boolean;
    alias: string;
    expectation_ms: number;
    file: string;
}
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
            performance: {
                run: boolean;
                tests: { [key: string]: IPerformanceTest };
            };
        };
        indexes: {
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
    };
}

export function readConfigurationFile(): Config {
    const config = (() => {
        const defaults = path.resolve(path.dirname(module.filename), 'defaults.json');
        let filename = (process.env as any)['JASMIN_TEST_CONFIGURATION'];
        if ((typeof filename !== 'string' || filename.trim() === '') && !fs.existsSync(defaults)) {
            return new Error(
                `To run test you should define a path to configuration file with JASMIN_TEST_CONFIGURATION=path_to_config_json_file`,
            );
        } else if (typeof filename !== 'string' || filename.trim() === '') {
            filename = defaults;
        }
        if (!fs.existsSync(filename)) {
            return new Error(`Configuration file ${filename} doesn't exist`);
        }
        const buffer = fs.readFileSync(filename);
        try {
            return new Config(JSON.parse(buffer.toString().replace(/\/\*.*\*\//gi, '')));
        } catch (err) {
            return new Error(
                `Fail to parse configuration file ${filename}; error: ${
                    err instanceof Error ? err.message : err
                }`,
            );
        }
    })();
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
        return config;
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
