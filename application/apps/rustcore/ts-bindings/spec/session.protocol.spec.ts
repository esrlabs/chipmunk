// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();

import { finish } from './common';
import { readConfigurationFile } from './config';

import * as protocol from 'protocol';
import * as $ from 'platform/types/observe';
import * as runners from './runners';
import * as fs from 'fs';
import * as path from 'path';

const config = readConfigurationFile().get().tests.protocol;

function deepEqualObj(a: any, b: any, depth = Infinity): boolean {
    if (depth < 1 || (typeof a !== 'object' && typeof b !== 'object')) {
        return a === b || (a == null && b == null);
    }
    if (a == null || b == null) {
        return a == null && b == null;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((item, index) => deepEqualObj(item, b[index], depth - 1));
    }
    if (typeof a === 'object' && typeof b === 'object') {
        const keys1 = Object.keys(a);
        const keys2 = Object.keys(b);

        if (keys1.length !== keys2.length) return false;
        if (!keys1.every((key) => keys2.includes(key))) return false;

        return keys1.every((key) => deepEqualObj(a[key], b[key], depth - 1));
    }
    return a === b;
}

const MAP: { [key: string]: (buf: Uint8Array) => any } = {
    AroundIndexes: protocol.decodeAroundIndexes,
    AttachmentInfo: protocol.decodeAttachmentInfo,
    AttachmentList: protocol.decodeAttachmentList,
    CallbackEvent: protocol.decodeCallbackEvent,
    CommandOutcome_bool: protocol.decodeCommandOutcomeWithbool,
    CommandOutcome_FoldersScanningResult: protocol.decodeCommandOutcomeWithFoldersScanningResult,
    CommandOutcome_i64: protocol.decodeCommandOutcomeWithi64,
    CommandOutcome_Option_String: protocol.decodeCommandOutcomeWithOptionString,
    CommandOutcome_SerialPortsList: protocol.decodeCommandOutcomeWithSerialPortsList,
    CommandOutcome_String: protocol.decodeCommandOutcomeWithString,
    CommandOutcome_Void: protocol.decodeCommandOutcomeWithVoid,
    ComputationError: protocol.decodeComputationError,
    DltParserSettings: protocol.decodeDltParserSettings,
    FileFormat: protocol.decodeFileFormat,
    FilterMatch: protocol.decodeFilterMatch,
    FilterMatchList: protocol.decodeFilterMatchList,
    FolderEntity: protocol.decodeFolderEntity,
    FolderEntityDetails: protocol.decodeFolderEntityDetails,
    FolderEntityType: protocol.decodeFolderEntityType,
    FoldersScanningResult: protocol.decodeFoldersScanningResult,
    GrabbedElement: protocol.decodeGrabbedElement,
    GrabbedElementList: protocol.decodeGrabbedElementList,
    LifecycleTransition: protocol.decodeLifecycleTransition,
    MulticastInfo: protocol.decodeMulticastInfo,
    NativeError: protocol.decodeNativeError,
    NativeErrorKind: protocol.decodeNativeErrorKind,
    ObserveOptions: protocol.decodeObserveOptions,
    ObserveOrigin: protocol.decodeObserveOrigin,
    OperationDone: protocol.decodeOperationDone,
    ParserType: protocol.decodeParserType,
    ProcessTransportConfig: protocol.decodeProcessTransportConfig,
    Progress: protocol.decodeProgress,
    Ranges: protocol.decodeRanges,
    SdeRequest: protocol.decodeSdeRequest,
    SdeResponse: protocol.decodeSdeResponse,
    SerialPortsList: protocol.decodeSerialPortsList,
    SerialTransportConfig: protocol.decodeSerialTransportConfig,
    Severity: protocol.decodeSeverity,
    SomeIpParserSettings: protocol.decodeSomeIpParserSettings,
    SourceDefinition: protocol.decodeSourceDefinition,
    Sources: protocol.decodeSources,
    TCPTransportConfig: protocol.decodeTCPTransportConfig,
    Transport: protocol.decodeTransport,
    UdpConnectionInfo: protocol.decodeUdpConnectionInfo,
    UDPTransportConfig: protocol.decodeUDPTransportConfig,
};

const OUTPUT_PATH_ENVVAR = 'CHIPMUNK_PROTOCOL_TEST_OUTPUT';

describe('Protocol', function () {
    it(config.regular.list[1], function () {
        return runners.noSession(config.regular, 1, async (logger, done) => {
            function check(origin: $.IObserve) {
                const bytes = protocol.encodeObserveOptions(origin);
                const decoded = protocol.decodeObserveOptions(bytes);
                expect(deepEqualObj(decoded, origin)).toBe(true);
            }
            check({
                origin: { File: ['somefile', $.Types.File.FileType.Text, 'path_to_file'] },
                parser: { Text: null },
            });
            check({
                origin: {
                    Stream: ['stream', { TCP: { bind_addr: '0.0.0.0' } }],
                },
                parser: { Text: null },
            });
            check({
                origin: {
                    Stream: [
                        'stream',
                        {
                            Process: {
                                command: 'command',
                                cwd: 'cwd',
                                envs: { one: 'one' },
                            },
                        },
                    ],
                },
                parser: { Text: null },
            });
            check({
                origin: {
                    Concat: [
                        ['somefile1', $.Types.File.FileType.Text, 'path_to_file'],
                        ['somefile2', $.Types.File.FileType.Text, 'path_to_file'],
                        ['somefile3', $.Types.File.FileType.Text, 'path_to_file'],
                    ],
                },
                parser: { Text: null },
            });
            check({
                origin: {
                    File: ['somefile', $.Types.File.FileType.Binary, 'path_to_file'],
                },
                parser: {
                    Dlt: {
                        fibex_file_paths: ['path'],
                        filter_config: undefined,
                        with_storage_header: true,
                        tz: 'zz',
                    },
                },
            });
            check({
                origin: {
                    File: ['somefile', $.Types.File.FileType.Binary, 'path_to_file'],
                },
                parser: {
                    Dlt: {
                        fibex_file_paths: [],
                        filter_config: undefined,
                        with_storage_header: true,
                        tz: 'zz',
                    },
                },
            });
            check({
                origin: {
                    File: ['somefile', $.Types.File.FileType.Binary, 'path_to_file'],
                },
                parser: {
                    Dlt: {
                        fibex_file_paths: undefined,
                        filter_config: undefined,
                        with_storage_header: true,
                        tz: 'zz',
                    },
                },
            });
            check({
                origin: {
                    File: ['somefile', $.Types.File.FileType.Binary, 'path_to_file'],
                },
                parser: {
                    Dlt: {
                        fibex_file_paths: ['path'],
                        filter_config: {
                            min_log_level: 1,
                            app_id_count: 1,
                            context_id_count: 1,
                            app_ids: ['test'],
                            ecu_ids: ['test'],
                            context_ids: ['test'],
                        },
                        with_storage_header: true,
                        tz: 'zz',
                    },
                },
            });
            check({
                origin: {
                    File: ['somefile', $.Types.File.FileType.PcapNG, 'path_to_file'],
                },
                parser: {
                    SomeIp: {
                        fibex_file_paths: ['path'],
                    },
                },
            });
            check({
                origin: {
                    File: ['somefile', $.Types.File.FileType.PcapNG, 'path_to_file'],
                },
                parser: {
                    SomeIp: {
                        fibex_file_paths: [],
                    },
                },
            });
            check({
                origin: {
                    File: ['somefile', $.Types.File.FileType.PcapNG, 'path_to_file'],
                },
                parser: {
                    SomeIp: {
                        fibex_file_paths: undefined,
                    },
                },
            });
            finish(undefined, done);
        });
    });
    it(config.regular.list[2], function () {
        return runners.noSession(config.regular, 2, async (logger, done) => {
            function check(origin: $.IObserve) {
                const bytes = protocol.encodeObserveOptions(origin);
                const decoded = protocol.decodeObserveOptions(bytes);
                expect(deepEqualObj(decoded, origin)).toBe(true);
            }
            const casesPath = process.env[OUTPUT_PATH_ENVVAR];
            if (typeof casesPath !== 'string' || casesPath.trim() === '') {
                logger.info('Testing of all use-cases is skipped');
                return finish(undefined, done);
            }
            if (!fs.existsSync(casesPath)) {
                return finish(
                    undefined,
                    done,
                    new Error(
                        `Fail to find data passed due PROTOCOL_TEST_CASES_PATH: ${casesPath} doesn't exist`,
                    ),
                );
            }
            const folders = fs.readdirSync(casesPath);
            for (let typeOfMessage of folders) {
                const targetFullPath = path.join(casesPath, typeOfMessage);
                if (!fs.statSync(targetFullPath).isDirectory()) {
                    continue;
                }
                const cases = fs.readdirSync(targetFullPath);
                for (let testCase of cases) {
                    const fullPath = path.join(targetFullPath, testCase);
                    if (!fs.statSync(fullPath).isFile()) {
                        continue;
                    }
                    const buffer = fs.readFileSync(fullPath);
                    const decoder = MAP[typeOfMessage];
                    if (decoder === undefined) {
                        return finish(
                            undefined,
                            done,
                            new Error(`Fail to find decoder for ${typeOfMessage}`),
                        );
                    }
                    // console.log(`Decoding: ${typeOfMessage}`);
                    const msg = decoder(Uint8Array.from(buffer));
                    // console.log(msg);
                }
            }
            finish(undefined, done);
        });
    });
});
