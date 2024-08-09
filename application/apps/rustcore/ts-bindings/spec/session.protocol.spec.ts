// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();

import { finish, runner } from './common';
import { readConfigurationFile } from './config';
import { Session } from '../src/api/session';

import * as proto from 'protocol';
import * as $ from 'platform/types/observe';
import * as Types from '../src/protocol';

const config = readConfigurationFile().get().tests.protocol;

describe('Protocol', function () {
    it(config.regular.list[1], function () {
        return runner(config.regular, 1, async (logger, done, collector) => {
            {
                let origin = Types.toObserveOptions({
                    origin: { File: ['somefile', $.Types.File.FileType.Text, 'path_to_file'] },
                    parser: { Text: null },
                });
                let decoded = proto.ObserveOptions.decode(proto.ObserveOptions.encode(origin));
                expect(JSON.stringify(origin)).toEqual(JSON.stringify(decoded));
            }
            {
                let origin = Types.toObserveOptions({
                    origin: {
                        Stream: ['stream', { TCP: { bind_addr: '0.0.0.0' } }],
                    },
                    parser: { Text: null },
                });
                let decoded = proto.ObserveOptions.decode(proto.ObserveOptions.encode(origin));
                expect(JSON.stringify(origin)).toEqual(JSON.stringify(decoded));
            }
            {
                let origin = Types.toObserveOptions({
                    origin: {
                        Stream: [
                            'stream',
                            { Process: { command: 'command', cwd: 'cwd', envs: { one: 'one' } } },
                        ],
                    },
                    parser: { Text: null },
                });
                let decoded = proto.ObserveOptions.decode(proto.ObserveOptions.encode(origin));
                expect(JSON.stringify(origin)).toEqual(JSON.stringify(decoded));
            }
            finish(undefined, done);
        });
    });
    it(config.regular.list[2], function () {
        return runner(config.regular, 2, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true);
                    const MESSAGES_COUNT = 100;
                    {
                        const meausere: { json: number; proto: number } = { json: 0, proto: 0 };
                        meausere.json = Date.now();
                        for (let i = MESSAGES_COUNT; i >= 0; i -= 1) {
                            const msg = session.getNativeSession().testGrabElsAsJson(false);
                            expect(msg instanceof Array).toBe(true);
                        }
                        meausere.json = Date.now() - meausere.json;
                        meausere.proto = Date.now();
                        for (let i = MESSAGES_COUNT; i >= 0; i -= 1) {
                            const msg = session.getNativeSession().testGrabElsAsProto(false);
                            expect(msg instanceof Array).toBe(true);
                        }
                        meausere.proto = Date.now() - meausere.proto;
                        console.log(
                            `Receiving messages count: ${MESSAGES_COUNT}\nJSON: ${
                                meausere.json
                            }ms (per msg ${(meausere.json / MESSAGES_COUNT).toFixed(2)});\nPROTO: ${
                                meausere.proto
                            }ms (per msg ${(meausere.proto / MESSAGES_COUNT).toFixed(2)})`,
                        );
                    }
                    {
                        const meausere: { json: number; proto: number } = { json: 0, proto: 0 };
                        meausere.json = Date.now();
                        for (let i = MESSAGES_COUNT; i >= 0; i -= 1) {
                            const msg = session.getNativeSession().testGrabElsAsJson();
                            expect(msg instanceof Array).toBe(true);
                        }
                        meausere.json = Date.now() - meausere.json;
                        meausere.proto = Date.now();
                        for (let i = MESSAGES_COUNT; i >= 0; i -= 1) {
                            const msg = session.getNativeSession().testGrabElsAsProto();
                            expect(msg instanceof Array).toBe(true);
                        }
                        meausere.proto = Date.now() - meausere.proto;
                        console.log(
                            `Grabbing messages count: ${MESSAGES_COUNT}\nJSON: ${
                                meausere.json
                            }ms (per msg ${(meausere.json / MESSAGES_COUNT).toFixed(2)});\nPROTO: ${
                                meausere.proto
                            }ms (per msg ${(meausere.proto / MESSAGES_COUNT).toFixed(2)})`,
                        );
                    }
                    finish(session, done);
                })
                .catch((err: Error) => {
                    finish(
                        undefined,
                        done,
                        new Error(
                            `Fail to create session due error: ${
                                err instanceof Error ? err.message : err
                            }`,
                        ),
                    );
                });
        });
    });
});
