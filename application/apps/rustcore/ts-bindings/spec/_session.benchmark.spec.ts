// tslint:disable

import { initLogger } from './logger';
initLogger();
import { Factory } from '../src/api/session';
import { createSampleFile, finish, performanceReport, setMeasurement } from './common';
import { readBenchmarkConfigurationFile } from './config_benchmarks';
import { IndexingMode } from 'platform/types/content';
import * as runners from './runners';

const config = readBenchmarkConfigurationFile().get().tests.benchmark;

describe('Benchmark Tests', function () {
    Object.keys(config).forEach((testId: string, index: number) => {
        const test = config[testId];
        const testName = `${test.alias}`;
        if (test.ignore) {
            console.log(`Test "${testName}" has been ignored`);
            return;
        }

        it(testName, function () {
            return runners.withSession(
                {
                    open_as: '',
                    ignore: false,
                    alias: testName,
                    expectation_ms: 10000,
                    file: '',
                },
                1,
                async (logger, done, { session, stream, events, search }) => {
                    const measurement = setMeasurement();
                    let home_dir = (process.env as any)['SH_HOME_DIR'];
                    if (!home_dir || typeof home_dir !== 'string' || home_dir.trim() === '') {
                        throw new Error(
                            'Environment variable SH_HOME_DIR is not set or is invalid.',
                        );
                    }

                    switch (testId) {
                        case 'test1':
                            stream
                                .observe(
                                    new Factory.File()
                                        .asText()
                                        .type(Factory.FileType.Text)
                                        .file(`${home_dir}/${test.file}`)
                                        .get()
                                        .sterilized(),
                                )
                                .catch(finish.bind(null, session, done));
                            break;
                        case 'test2':
                            stream
                                .observe(
                                    new Factory.File()
                                        .type(Factory.FileType.Binary)
                                        .file(`${home_dir}/${test.file}`)
                                        .asDlt({
                                            filter_config: undefined,
                                            fibex_file_paths: [],
                                            with_storage_header: true,
                                            tz: undefined,
                                        })
                                        .get()
                                        .sterilized(),
                                )
                                .catch(finish.bind(null, session, done));
                            break;
                        case 'test3':
                            stream
                                .observe(
                                    new Factory.File()
                                        .type(Factory.FileType.PcapNG)
                                        .file(`${home_dir}/${test.file}`)
                                        .asDlt({
                                            filter_config: undefined,
                                            fibex_file_paths: [],
                                            with_storage_header: false,
                                            tz: undefined,
                                        })
                                        .get()
                                        .sterilized(),
                                )
                                .catch(finish.bind(null, session, done));
                            break;
                        case 'test4':
                            const tmpobj1 = createSampleFile(
                                5000,
                                logger,
                                (i: number) => `some line data: ${i}\n`,
                            );

                            let {
                                session: startupSession,
                                stream: startupStream,
                                events: startupEvents,
                                search: startupSearch,
                            } = await runners.initializeSession(testName);

                            startupStream.observe(
                                new Factory.Stream()
                                    .asText()
                                    .process({
                                        command: `less ${tmpobj1.name}`,
                                        cwd: process.cwd(),
                                        envs: process.env as { [key: string]: string },
                                    })
                                    .get()
                                    .sterilized(),
                            );
                            const startupResults = measurement();
                            const startupReport = performanceReport(
                                testName,
                                startupResults.ms,
                                test.expectation_ms,
                                `${home_dir}/${test.file}`,
                            );
                            finish(
                                [startupSession, session],
                                done,
                                startupReport ? undefined : new Error(`${testName} is fail`),
                            );
                            break;
                        case 'test5':
                            const tmpobj2 = createSampleFile(
                                5000,
                                logger,
                                (i: number) => `some line data: ${i}\n`,
                            );

                            stream.observe(
                                new Factory.Stream()
                                    .asText()
                                    .process({
                                        command: `less ${tmpobj2.name}`,
                                        cwd: process.cwd(),
                                        envs: process.env as { [key: string]: string },
                                    })
                                    .get()
                                    .sterilized(),
                            );
                            const shutdownResult = measurement();
                            const shutdownReport = performanceReport(
                                testName,
                                shutdownResult.ms,
                                test.expectation_ms,
                                `${home_dir}/${test.file}`,
                            );
                            finish(
                                session,
                                done,
                                shutdownReport ? undefined : new Error(`${testName} is fail`),
                            );
                            break;
                        case 'test6':
                            const multiSessions = [session];
                            for (let i = 0; i < 50; i++) {
                                const file = createSampleFile(
                                    100,
                                    logger,
                                    (j: number) => `file ${i} line data: ${j}\n`,
                                );

                                let {
                                    session: multiSession,
                                    stream: multiSessionStream,
                                    events: multiSessionEvents,
                                    search: multiSessionSearch,
                                } = await runners.initializeSession(testName);
                                multiSessions.push(multiSession);

                                multiSessionStream
                                    .observe(
                                        new Factory.Stream()
                                            .asText()
                                            .process({
                                                command: `less ${file.name}`,
                                                cwd: process.cwd(),
                                                envs: process.env as { [key: string]: string },
                                            })
                                            .get()
                                            .sterilized(),
                                    )
                                    .catch(
                                        (err: Error) => `File ${i} failed to open: ${err.message}`,
                                    );
                            }
                            const testResult = measurement();
                            const testReport = performanceReport(
                                testName,
                                testResult.ms,
                                test.expectation_ms,
                                `${home_dir}/${test.file}`,
                            );
                            finish(
                                multiSessions,
                                done,
                                testReport ? undefined : new Error(`${testName} is fail`),
                            );
                            break;
                        case 'test7':
                            let controlSum = 0;
                            let countMatches = 0;
                            let read: boolean = false;
                            stream
                                .observe(
                                    new Factory.File()
                                        .asText()
                                        .type(Factory.FileType.Text)
                                        .file(`${home_dir}/${test.file}`)
                                        .get()
                                        .sterilized(),
                                )
                                .catch(finish.bind(null, session, done));
                            const updates: number[] = [];
                            events.IndexedMapUpdated.subscribe((event: any) => {
                                event.len > 0 && updates.push(event.len);
                            });
                            events.StreamUpdated.subscribe(async () => {
                                read = true;
                                try {
                                    await search.search([
                                        {
                                            filter: 'HTTP',
                                            flags: {
                                                reg: true,
                                                word: true,
                                                cases: false,
                                                invert: false,
                                            },
                                        },
                                    ]);
                                    let items = await stream.grabIndexed(0, countMatches);
                                    await stream.setIndexingMode(IndexingMode.Breadcrumbs);
                                    finish(session, done);
                                } catch (err) {
                                    finish(
                                        undefined,
                                        done,
                                        new Error(
                                            `Fail to finish test due error: ${
                                                err instanceof Error ? err.message : err
                                            }`,
                                        ),
                                    );
                                }
                            });
                            break;
                        case 'test8':
                            stream
                                .observe(
                                    new Factory.File()
                                        .asText()
                                        .type(Factory.FileType.Text)
                                        .file(`${home_dir}/${test.file}`)
                                        .get()
                                        .sterilized(),
                                )
                                .on('processing', () => {
                                    search
                                        .search([
                                            {
                                                filter: 'http',
                                                flags: {
                                                    reg: true,
                                                    word: false,
                                                    cases: false,
                                                    invert: false,
                                                },
                                            },
                                        ])
                                        .catch(finish.bind(null, session, done));
                                })
                                .catch(finish.bind(null, session, done));
                            break;
                        case 'test9':
                            stream
                                .observe(
                                    new Factory.File()
                                        .asText()
                                        .type(Factory.FileType.Text)
                                        .file(`${home_dir}/${test.file}`)
                                        .get()
                                        .sterilized(),
                                )
                                .on('processing', () => {
                                    search
                                        .search([
                                            {
                                                filter: 'http://www.almhuette-raith.at',
                                                flags: {
                                                    reg: true,
                                                    word: false,
                                                    cases: false,
                                                    invert: false,
                                                },
                                            },
                                            {
                                                filter: 'com.apple.hiservices-xpcservice',
                                                flags: {
                                                    reg: true,
                                                    word: false,
                                                    cases: false,
                                                    invert: false,
                                                },
                                            },
                                            {
                                                filter: 'Google Chrome Helper',
                                                flags: {
                                                    reg: true,
                                                    word: false,
                                                    cases: false,
                                                    invert: false,
                                                },
                                            },
                                        ])
                                        .catch(finish.bind(null, session, done));
                                })
                                .catch(finish.bind(null, session, done));
                            break;
                        default:
                            throw new Error(`Unsupported format or alias: ${test.alias}`);
                    }
                    events.FileRead.subscribe(() => {
                        const results = measurement();
                        const reportResult = performanceReport(
                            testName,
                            results.ms,
                            test.expectation_ms,
                            `${home_dir}/${test.file}`,
                        );
                        finish(
                            session,
                            done,
                            reportResult ? undefined : new Error(`${testName} is fail`),
                        );
                    });
                },
            );
        });
    });
});
