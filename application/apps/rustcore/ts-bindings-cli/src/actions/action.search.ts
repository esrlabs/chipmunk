import { Action } from './action';
import { Session } from '../../../ts-bindings/src/api/session';
import { IGrabbedElement } from '../../../ts-bindings/src/interfaces/index';
import { isOutputAllowed } from './action.output';

import * as path from 'path';
import * as fs from 'fs';

const KEYS: string[] = [`--search`, `-s`];
const ENOENT: string = 'ENOENT';
const DEF_FROM: number = 0;
const DEF_COUNT: number = 100;

interface IParams {
    filename: string;
    from: number;
    count: number;
    filters: string[];
}

export class SearchInFile extends Action {
    private _args: {
        start: number;
        end: number;
    } = {
        start: -1,
        end: -1,
    };

    public name(): string {
        return `Search in given file`;
    }

    public key(): string[] {
        return KEYS;
    }

    public pattern(): string {
        return `${KEYS[0]} filename[start:count] "filter" "filter" ...`;
    }

    public valid(args: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const params: IParams | undefined | Error = this._getParams(args);
            if (params instanceof Error) {
                return reject(params);
            }
            if (params === undefined) {
                return resolve();
            }
            fs.access(params.filename, fs.constants.F_OK, (err: NodeJS.ErrnoException | null) => {
                if (err) {
                    if (err.code === ENOENT) {
                        return reject(new Error(`File doesn't exist`));
                    } else {
                        return reject(err);
                    }
                } else {
                    resolve();
                }
            });
        });
    }

    public proceed(args: string[]): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const params: IParams | undefined | Error = this._getParams(args);
            if (params instanceof Error) {
                return reject(params);
            }
            if (params === undefined) {
                return resolve(args);
            }
            const started: number = Date.now();
            const session = new Session();
            // Set provider into debug mode
            session.debug(true);
            const stream = session.getStream();
            const search = session.getSearch();
            if (stream instanceof Error) {
                return reject(stream);
            }
            if (search instanceof Error) {
                return reject(search);
            }
            stream
                .observe(params.filename, {})
                .then(() => {
                    search
                        .search(
                            params.filters.map((filter) => {
                                return {
                                    filter: filter,
                                    flags: { reg: true, word: false, cases: false },
                                };
                            }),
                        )
                        .then(() => {
                            search
                                .grab(params.from, params.count)
                                .then((grabbed: IGrabbedElement[]) => {
                                    const stat = session.getDebugStat();
                                    if (stat.unsupported.length !== 0) {
                                        return reject(
                                            new Error(
                                                `Unsupported events:\n\t- ${stat.unsupported.join(
                                                    '\n\t- ',
                                                )}`,
                                            ),
                                        );
                                    }
                                    if (stat.errors.length !== 0) {
                                        return reject(
                                            new Error(`Errors:\n\t- ${stat.errors.join('\n\t- ')}`),
                                        );
                                    }
                                    const finished = Date.now();
                                    isOutputAllowed() && console.log(`\n${'='.repeat(62)}`);
                                    isOutputAllowed() && console.log(`Filters:`);
                                    isOutputAllowed() &&
                                        console.log(`\t- ${params.filters.join(`\n\t- `)}`);
                                    isOutputAllowed() && console.log(`\n${'='.repeat(62)}`);
                                    console.log(
                                        `Grab data from ${params.from} to ${
                                            params.from + params.count
                                        } in ${finished - started} ms`,
                                    );
                                    isOutputAllowed() &&
                                        console.log(`${'='.repeat(5)} BEGIN ${'='.repeat(50)}`);
                                    grabbed.forEach((item, i) => {
                                        isOutputAllowed() &&
                                            console.log(`${i + params.from}:\t${item.content}`);
                                    });
                                    isOutputAllowed() &&
                                        console.log(`${'='.repeat(5)} END   ${'='.repeat(50)}`);
                                    resolve(
                                        args.filter((arg, i) => {
                                            if (i < this._args.start || i > this._args.end) {
                                                return true;
                                            } else {
                                                return false;
                                            }
                                        }),
                                    );
                                })
                                .catch((err: Error) => {
                                    reject(
                                        new Error(`Fail to grab data due error: ${err.message}`),
                                    );
                                });
                        })
                        .catch((err: Error) => {
                            reject(err);
                        })
                        .finally(() => {
                            session.destroy();
                        });
                })
                .catch((err: Error) => {
                    session.destroy();
                    reject(err);
                });
        });
    }

    private _getParams(args: string[]): IParams | undefined | Error {
        function getFileName(filename: string): string {
            if (filename.indexOf('.') === 0) {
                return path.normalize(path.resolve(process.cwd(), filename));
            } else {
                return path.normalize(filename);
            }
        }
        const index: number = (() => {
            let i: number = -1;
            KEYS.forEach((key: string) => {
                if (i === -1) {
                    i = args.indexOf(key);
                }
            });
            return i;
        })();
        if (index === -1) {
            return undefined;
        }
        if (index === args.length - 1) {
            return new Error(`No filename provided`);
        }
        const params: IParams = {
            filename: '',
            from: DEF_FROM,
            count: DEF_COUNT,
            filters: [],
        };
        let end: number = -1;
        for (let i = index + 1; i < args.length; i += 1) {
            if (args[i].indexOf('-') !== 0 && params.filename === '') {
                params.filename = getFileName(args[i].replace(/\[\d{1,}:\d{1,}\]/gi, ''));
                const coors: RegExpMatchArray | null = args[i].match(/\[\d{1,}:\d{1,}\]/gi);
                if (coors !== null) {
                    const pair = coors[0]
                        .replace(/[\[\]]/gi, '')
                        .split(':')
                        .map((v) => parseInt(v, 10));
                    if (
                        pair.length !== 2 ||
                        isNaN(pair[0]) ||
                        isNaN(pair[1]) ||
                        !isFinite(pair[0]) ||
                        !isFinite(pair[1])
                    ) {
                        return new Error(`Invalid coors: ${coors[0]}`);
                    }
                    params.from = pair[0];
                    params.count = pair[1];
                }
            } else if (args[i].indexOf('-') !== 0 && params.filename !== '') {
                params.filters.push(args[i].replace(/^"|"$/gi, ''));
            } else if (args[i].indexOf('-') === 0) {
                end = i - 1;
                break;
            }
        }
        if (params.filename === '') {
            return new Error(`No filename provided`);
        } else if (params.filters.length === 0) {
            return new Error(`No any filter provided`);
        } else {
            this._args = {
                start: index + 1,
                end: end,
            };
        }
        return params;
    }
}

export default new SearchInFile();
