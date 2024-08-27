// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();
import { Session, Factory } from '../src/api/session';
import { IAttachmentsUpdatedUpdated } from '../src/api/session.provider';
import { IAttachment } from 'platform/types/content';
import { createSampleFile, finish, performanceReport, setMeasurement, runner } from './common';
import { readBenchmarkConfigurationFile } from './config_benchmarks';
import { IndexingMode } from 'platform/types/content';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const config = readBenchmarkConfigurationFile().get().tests.benchmark;

describe('Benchmark Tests', function () {
    Object.keys(config.performance.tests).forEach((alias: string) => {
        const test = config.performance.tests[alias];
        const testName = `${test.alias}`;
        if (test.ignore) {
            console.log(`Test "${testName}" has been ignored`);
            return;
        }

        it(testName, function () {
            return runner(
                    {
                        open_as: '',
                        ignore: false,
                        alias: testName,
                        expectation_ms: 10000,
                        file: '',
                    },
                    1,
                    async (logger, done, collector) => {
                    const measurement = setMeasurement();
                    try {
                        const session = await Session.create();
                        session.debug(true, testName);

                        const stream = session.getStream();
                        if (stream instanceof Error) throw stream;

                        const events = session.getEvents();
                        if (events instanceof Error) throw events;

                        const search = session.getSearch();

                        let home_dir = (process.env as any)['SH_HOME_DIR'];

                        // Handle based on the test type
                        switch (test.alias) {
                            case 'Observe - grab content (text)':
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
                            case 'Observe - grab content (dlt)':
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
                            case 'Observe - grab content (pcapng)':
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
                            case 'Stream - startup measurement':
                                const tmpobj1 = createSampleFile(
                                    5000,
                                    logger,
                                    (i: number) => `some line data: ${i}\n`
                                );

                                const startupSession = await Session.create();
                                startupSession.debug(true, testName);

                                const startupStream = startupSession.getStream();
                                if (startupStream instanceof Error) throw startupStream;

                                const startupEvents = session.getEvents();
                                if (startupEvents instanceof Error) throw startupEvents;
                                startupStream.observe(
                                    new Factory.Stream()
                                        .asText()
                                        .process({
                                            command: `less ${tmpobj1.name}`,
                                            cwd: process.cwd(),
                                            envs: process.env as { [key: string]: string },
                                        })
                                        .get()
                                        .sterilized()
                                );
                                const startupResults = measurement();
                                const startupReport = performanceReport(testName, startupResults.ms, test.expectation_ms, `${home_dir}/${test.file}`);
                                finish(startupSession, done, startupReport ? undefined : new Error(`${testName} is fail`));
                                break;
                            case 'Stream - shutdown measurement':
                                const tmpobj2 = createSampleFile(
                                    5000,
                                    logger,
                                    (i: number) => `some line data: ${i}\n`
                                );

                                const shutdownSession = await Session.create();
                                shutdownSession.debug(true, testName);

                                const shutdownStream = shutdownSession.getStream();
                                if (shutdownStream instanceof Error) throw shutdownStream;

                                shutdownStream.observe(
                                    new Factory.Stream()
                                        .asText()
                                        .process({
                                            command: `less ${tmpobj2.name}`,
                                            cwd: process.cwd(),
                                            envs: process.env as { [key: string]: string },
                                        })
                                        .get()
                                        .sterilized()
                                );
                                const shutdownResults = measurement();
                                const shutdownReport = performanceReport(testName, shutdownResults.ms, test.expectation_ms, `${home_dir}/${test.file}`);
                                finish(shutdownSession, done, shutdownReport ? undefined : new Error(`${testName} is fail`));
                                break;
                            case 'Stream - Open 50 sessions':
                                const results = [];
                                const multiSessions = [];
                                for (let i = 0; i < 50; i++) {
                                    const file = createSampleFile(
                                        100,
                                        logger,
                                        (j: number) => `file ${i} line data: ${j}\n`
                                    );

                                    const multiSession = await Session.create();
                                    multiSessions.push(multiSession);

                                    const multiStream = multiSession.getStream();
                                    if (multiStream instanceof Error) {
                                        throw multiStream;
                                    }

                                    let result = multiStream.observe(
                                        new Factory.Stream()
                                            .asText()
                                            .process({
                                                command: `less ${file.name}`,
                                                cwd: process.cwd(),
                                                envs: process.env as { [key: string]: string },
                                            })
                                            .get()
                                            .sterilized()
                                    ).catch((err) => `File ${i} failed to open: ${err.message}`);
                                    results.push(result);
                                }
                                const multiResults = measurement();
                                const multiReport = performanceReport(testName, multiResults.ms, test.expectation_ms, `${home_dir}/${test.file}`);
                                finish(undefined, done, multiReport ? undefined : new Error(`${testName} is fail`));
                                break;
                            case 'Indexes - Switch to breadcrumb mode':
                                let controlSum = 0;
                                let countMatches = 0;
                                let read: boolean = false;
                                stream
                                    .observe(
                                        new Factory.File()
                                            .asText()
                                            .type(Factory.FileType.Text)
                                            .file(`${home_dir}/${test.file}`)
                                            .get().sterilized(),
                                    )
                                    .catch(finish.bind(null, session, done));
                                const updates: number[] = [];
                                events.IndexedMapUpdated.subscribe((event) => {
                                    event.len > 0 && updates.push(event.len);
                                });
                                events.StreamUpdated.subscribe(async () => {
                                    read = true;
                                    try {
                                        await search.search([
                                            {
                                                filter: 'HTTP',
                                                flags: { reg: true, word: true, cases: false },
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
                            case 'Assign & single search':
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
                                                            flags: { reg: true, word: false, cases: false },
                                                        },
                                                    ])
                                                    .catch(finish.bind(null, session, done));
                                            })
                                            .catch(finish.bind(null, session, done));
                                        break;
                            case 'Assign & multiple search':
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
                                                            flags: { reg: true, word: false, cases: false },
                                                        },
                                                        {
                                                            filter: 'com.apple.hiservices-xpcservice',
                                                            flags: { reg: true, word: false, cases: false },
                                                        },
                                                        {
                                                            filter: 'Google Chrome Helper',
                                                            flags: { reg: true, word: false, cases: false },
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
                            const reportResult = performanceReport(testName, results.ms, test.expectation_ms, `${home_dir}/${test.file}`);
                            finish(session, done, reportResult ? undefined : new Error(`${testName} is fail`));
                        });

                    } catch (err) {
                        finish(undefined, done, new Error(`Failed to complete test "${testName}" due to error: ${err instanceof Error ? err.message : err}`));
                    }
                },
            );
        });
    });
});