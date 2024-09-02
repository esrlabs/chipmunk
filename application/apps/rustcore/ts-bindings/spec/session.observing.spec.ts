// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { finish } from './common';
import { readConfigurationFile } from './config';
import { Observer } from 'platform/env/observer';

import * as $ from 'platform/types/observe';
import * as Factory from 'platform/types/observe/factory';
import * as runners from './runners';

const config = readConfigurationFile().get().tests.observing;

function checkContext(
    observe: $.Observe,
    flags: { file: boolean; stream: boolean; concat: boolean },
) {
    expect(
        observe.origin.as<$.Origin.Stream.Configuration>($.Origin.Stream.Configuration) instanceof
            $.Origin.Stream.Configuration,
    ).toEqual(flags.stream);
    expect(
        observe.origin.as<$.Origin.File.Configuration>($.Origin.File.Configuration) instanceof
            $.Origin.File.Configuration,
    ).toEqual(flags.file);
    expect(
        observe.origin.as<$.Origin.Concat.Configuration>($.Origin.Concat.Configuration) instanceof
            $.Origin.Concat.Configuration,
    ).toEqual(flags.concat);
}

function checkStream(
    observe: $.Observe,
    flags: { udp: boolean; tcp: boolean; serial: boolean; process: boolean },
) {
    expect(
        observe.origin.as<$.Origin.Stream.Stream.UDP.Configuration>(
            $.Origin.Stream.Stream.UDP.Configuration,
        ) instanceof $.Origin.Stream.Stream.UDP.Configuration,
    ).toEqual(flags.udp);
    expect(
        observe.origin.as<$.Origin.Stream.Stream.TCP.Configuration>(
            $.Origin.Stream.Stream.TCP.Configuration,
        ) instanceof $.Origin.Stream.Stream.TCP.Configuration,
    ).toEqual(flags.tcp);
    expect(
        observe.origin.as<$.Origin.Stream.Stream.Process.Configuration>(
            $.Origin.Stream.Stream.Process.Configuration,
        ) instanceof $.Origin.Stream.Stream.Process.Configuration,
    ).toEqual(flags.process);
    expect(
        observe.origin.as<$.Origin.Stream.Stream.Serial.Configuration>(
            $.Origin.Stream.Stream.Serial.Configuration,
        ) instanceof $.Origin.Stream.Stream.Serial.Configuration,
    ).toEqual(flags.serial);
}

function checkParser(observe: $.Observe, flags: { text: boolean; dlt: boolean; someip: boolean }) {
    expect(
        observe.parser.as<$.Parser.Text.Configuration>($.Parser.Text.Configuration) instanceof
            $.Parser.Text.Configuration,
    ).toEqual(flags.text);
    expect(
        observe.parser.as<$.Parser.Dlt.Configuration>($.Parser.Dlt.Configuration) instanceof
            $.Parser.Dlt.Configuration,
    ).toEqual(flags.dlt);
    expect(
        observe.parser.as<$.Parser.SomeIp.Configuration>($.Parser.SomeIp.Configuration) instanceof
            $.Parser.SomeIp.Configuration,
    ).toEqual(flags.someip);
}

describe('Platform: observing', function () {
    it(config.regular.list[1], function () {
        return runners.noSession(config.regular, 1, async (logger, done) => {
            const entity = new Observer({
                a: 1,
                b: 2,
                c: [1, 2, 3],
                d: [
                    { a: 1, b: 2, c: [1, 2, 3] },
                    { a: 1, b: 2, c: [1, 2, 3] },
                ],
            });
            let changes: number = 0;
            entity.watcher.subscribe((event) => {
                changes += 1;
                if (changes === 1) {
                    expect(entity.target.a).toEqual(2);
                } else if (changes === 2) {
                    expect(entity.target.b).toEqual(3);
                } else if (changes === 3) {
                    expect(entity.target.c.length).toEqual(4);
                }
            });
            entity.target.a += 1;
            expect(entity.target.a).toEqual(2);
            entity.target.b += 1;
            expect(entity.target.b).toEqual(3);
            entity.target.c.push(4);
            expect(entity.target.c.length).toEqual(4);
            entity.target.c.splice(1, 1);
            expect(entity.target.c.length).toEqual(3);
            entity.target.d[0].a += 1;
            expect(entity.target.d[0].a).toEqual(2);
            entity.target.d[0].b += 1;
            expect(entity.target.d[0].b).toEqual(3);
            entity.target.d[0].c.push(4);
            expect(entity.target.d[0].c.length).toEqual(4);
            entity.target.d.push({ a: 1, b: 2, c: [1, 2, 3] });
            expect(entity.target.d.length).toEqual(3);
            entity.target.d[entity.target.d.length - 1].a += 1;
            expect(entity.target.d[entity.target.d.length - 1].a).toEqual(2);
            entity.target.d[entity.target.d.length - 1].b += 1;
            expect(entity.target.d[entity.target.d.length - 1].b).toEqual(3);
            entity.target.d[entity.target.d.length - 1].c.push(4);
            expect(entity.target.d[entity.target.d.length - 1].c.length).toEqual(4);
            entity.target.d.splice(1, 1);
            expect(entity.target.d.length).toEqual(2);
            (entity.target as any)['newProp'] = 'test';
            expect((entity.target as any)['newProp']).toEqual('test');
            (entity.target as any)['newObj'] = { a: 1, b: 2 };
            (entity.target as any)['newObj'].a += 1;
            (entity.target as any)['newObj'].b += 1;
            expect((entity.target as any)['newObj'].a).toEqual(2);
            expect((entity.target as any)['newObj'].b).toEqual(3);
            // Note: splice of array gives multiple changes:
            // - change of position of each element
            // - change of array's length
            expect(changes).toEqual(19);
            finish(undefined, done);
        });
    });

    it(config.regular.list[2], function () {
        return runners.noSession(config.regular, 2, async (logger, done) => {
            const observe = new Factory.Stream().asDlt().tcp().get();
            checkStream(observe, { udp: false, tcp: true, serial: false, process: false });
            const stream = observe.origin.as<$.Origin.Stream.Configuration>(
                $.Origin.Stream.Configuration,
            ) as $.Origin.Stream.Configuration;
            expect(stream instanceof $.Origin.Stream.Configuration).toEqual(true);
            stream.change(
                new $.Origin.Stream.Stream.UDP.Configuration(
                    $.Origin.Stream.Stream.UDP.Configuration.initial(),
                    undefined,
                ),
            );
            expect(
                stream.as<$.Origin.Stream.Stream.UDP.Configuration>(
                    $.Origin.Stream.Stream.UDP.Configuration,
                ) instanceof $.Origin.Stream.Stream.UDP.Configuration,
            ).toEqual(true);
            checkStream(observe, { udp: true, tcp: false, serial: false, process: false });
            stream.change(
                new $.Origin.Stream.Stream.Serial.Configuration(
                    $.Origin.Stream.Stream.Serial.Configuration.initial(),
                    undefined,
                ),
            );
            checkStream(observe, { udp: false, tcp: false, serial: true, process: false });
            expect(
                stream.as<$.Origin.Stream.Stream.Serial.Configuration>(
                    $.Origin.Stream.Stream.Serial.Configuration,
                ) instanceof $.Origin.Stream.Stream.Serial.Configuration,
            ).toEqual(true);
            stream.change(
                new $.Origin.Stream.Stream.Process.Configuration(
                    $.Origin.Stream.Stream.Process.Configuration.initial(),
                    undefined,
                ),
            );
            checkStream(observe, { udp: false, tcp: false, serial: false, process: true });
            expect(
                stream.as<$.Origin.Stream.Stream.Process.Configuration>(
                    $.Origin.Stream.Stream.Process.Configuration,
                ) instanceof $.Origin.Stream.Stream.Process.Configuration,
            ).toEqual(true);
            // Command for process isn't defined; so validation should give error
            expect(observe.validate() instanceof Error).toEqual(true);
            const process = observe.origin.as<$.Origin.Stream.Stream.Process.Configuration>(
                $.Origin.Stream.Stream.Process.Configuration,
            ) as $.Origin.Stream.Stream.Process.Configuration;
            expect(process !== undefined).toEqual(true);
            process.configuration.command = 'ls -lsa';
            process.configuration.cwd = '/';
            // As soon as command and cwd are defined, validation should be OK
            expect(observe.validate() instanceof Error).toEqual(false);
            // Set invalid command
            process.configuration.command = '';
            expect(observe.validate() instanceof Error).toEqual(true);
            stream.change(
                new $.Origin.Stream.Stream.TCP.Configuration(
                    $.Origin.Stream.Stream.TCP.Configuration.initial(),
                    undefined,
                ),
            );
            checkStream(observe, { udp: false, tcp: true, serial: false, process: false });
            expect(
                stream.as<$.Origin.Stream.Stream.TCP.Configuration>(
                    $.Origin.Stream.Stream.TCP.Configuration,
                ) instanceof $.Origin.Stream.Stream.TCP.Configuration,
            ).toEqual(true);
            const tcp = observe.origin.as<$.Origin.Stream.Stream.TCP.Configuration>(
                $.Origin.Stream.Stream.TCP.Configuration,
            ) as $.Origin.Stream.Stream.TCP.Configuration;
            expect(tcp !== undefined).toEqual(true);
            // No binding address, should be error
            expect(observe.validate() instanceof Error).toEqual(true);
            tcp.configuration.bind_addr = '0.0.0.0';
            // Valid IP address setup, no errors should be
            expect(observe.validate() instanceof Error).toEqual(false);
            stream.change(
                new $.Origin.Stream.Stream.UDP.Configuration(
                    $.Origin.Stream.Stream.UDP.Configuration.initial(),
                    undefined,
                ),
            );
            checkStream(observe, { udp: true, tcp: false, serial: false, process: false });
            const udp = observe.origin.as<$.Origin.Stream.Stream.UDP.Configuration>(
                $.Origin.Stream.Stream.UDP.Configuration,
            ) as $.Origin.Stream.Stream.UDP.Configuration;
            expect(udp !== undefined).toEqual(true);
            // No binding address, should be error
            expect(observe.validate() instanceof Error).toEqual(true);
            udp.configuration.bind_addr = '0.0.0.0';
            // Valid IP address setup, no errors should be
            expect(observe.validate() instanceof Error).toEqual(false);
            udp.configuration.multicast.push({
                multiaddr: '',
                interface: '',
            });
            // Not valid multicast, should be error
            expect(observe.validate() instanceof Error).toEqual(true);
            udp.configuration.multicast[0].multiaddr = '0.0.0.0';
            udp.configuration.multicast[0].interface = '0.0.0.0';
            // Valid multicast setup, no errors should be
            expect(observe.validate() instanceof Error).toEqual(false);
            finish(undefined, done);
        });
    });

    it(config.regular.list[3], function () {
        return runners.noSession(config.regular, 3, async (logger, done) => {
            const observe = new Factory.File().type($.Types.File.FileType.Text).asText().get();
            checkContext(observe, { file: true, concat: false, stream: false });
            let file = observe.origin.as<$.Origin.File.Configuration>(
                $.Origin.File.Configuration,
            ) as $.Origin.File.Configuration;
            expect(file.filetype()).toEqual($.Types.File.FileType.Text);
            expect(observe.validate() instanceof Error).toEqual(true);
            const filename = '/some_file_name';
            file.set().filename(filename);
            expect(observe.validate() instanceof Error).toEqual(false);
            file.set().type($.Types.File.FileType.Binary);
            observe.parser.change(
                new $.Parser.Dlt.Configuration($.Parser.Dlt.Configuration.initial(), undefined),
            );
            expect(observe.validate() instanceof Error).toEqual(false);
            file = observe.origin.as<$.Origin.File.Configuration>(
                $.Origin.File.Configuration,
            ) as $.Origin.File.Configuration;
            expect(file.filename()).toEqual(filename);
            expect(file.filetype()).toEqual($.Types.File.FileType.Binary);
            finish(undefined, done);
        });
    });

    it(config.regular.list[4], function () {
        return runners.noSession(config.regular, 4, async (logger, done) => {
            const observe = new Factory.File().type($.Types.File.FileType.Text).asText().get();
            checkParser(observe, { text: true, dlt: false, someip: false });
            let file = observe.origin.as<$.Origin.File.Configuration>(
                $.Origin.File.Configuration,
            ) as $.Origin.File.Configuration;
            expect(file.filetype()).toEqual($.Types.File.FileType.Text);
            file.set().type($.Types.File.FileType.Binary);
            observe.parser.change(
                new $.Parser.Dlt.Configuration($.Parser.Dlt.Configuration.initial(), undefined),
            );
            checkParser(observe, { text: false, dlt: true, someip: false });
            expect(observe.validate() instanceof Error).toEqual(true);
            file.set().type($.Types.File.FileType.PcapNG);
            observe.parser.change(
                new $.Parser.SomeIp.Configuration(
                    $.Parser.SomeIp.Configuration.initial(),
                    undefined,
                ),
            );
            checkParser(observe, { text: false, dlt: false, someip: true });
            expect(observe.validate() instanceof Error).toEqual(true);
            file.set().filename('some_file');
            expect(observe.validate() instanceof Error).toEqual(false);
            finish(undefined, done);
        });
    });

    it(config.regular.list[5], function () {
        return runners.noSession(config.regular, 5, async (logger, done) => {
            const observe = new Factory.Stream().asDlt().tcp().get();
            checkStream(observe, { udp: false, tcp: true, serial: false, process: false });
            observe.subscribe(() => {
                if (currentAction >= actions.length) {
                    console.log(`[warn] Update out of actions (this is NOT an error)`);
                    return;
                }
                actions[currentAction].check();
                next();
            });
            const actions = [
                {
                    action: () => {
                        const stream = observe.origin.as<$.Origin.Stream.Configuration>(
                            $.Origin.Stream.Configuration,
                        ) as $.Origin.Stream.Configuration;
                        expect(stream instanceof $.Origin.Stream.Configuration).toEqual(true);
                        stream.change(
                            new $.Origin.Stream.Stream.UDP.Configuration(
                                $.Origin.Stream.Stream.UDP.Configuration.initial(),
                                undefined,
                            ),
                        );
                    },
                    check: () => {
                        checkStream(observe, {
                            udp: true,
                            tcp: false,
                            serial: false,
                            process: false,
                        });
                        expect(observe.validate() instanceof Error).toEqual(true);
                    },
                },
                {
                    action: () => {
                        const udp = observe.origin.as<$.Origin.Stream.Stream.UDP.Configuration>(
                            $.Origin.Stream.Stream.UDP.Configuration,
                        ) as $.Origin.Stream.Stream.UDP.Configuration;
                        expect(udp instanceof $.Origin.Stream.Stream.UDP.Configuration).toEqual(
                            true,
                        );
                        udp.configuration.bind_addr = '0.0.0.0';
                    },
                    check: () => {
                        expect(observe.validate() instanceof Error).toEqual(false);
                    },
                },
                {
                    action: () => {
                        const udp = observe.origin.as<$.Origin.Stream.Stream.UDP.Configuration>(
                            $.Origin.Stream.Stream.UDP.Configuration,
                        ) as $.Origin.Stream.Stream.UDP.Configuration;
                        expect(udp instanceof $.Origin.Stream.Stream.UDP.Configuration).toEqual(
                            true,
                        );
                        udp.configuration.multicast.push({ multiaddr: '', interface: '0.0.0.0' });
                    },
                    check: () => {
                        expect(observe.validate() instanceof Error).toEqual(true);
                        const udp = observe.origin.as<$.Origin.Stream.Stream.UDP.Configuration>(
                            $.Origin.Stream.Stream.UDP.Configuration,
                        ) as $.Origin.Stream.Stream.UDP.Configuration;
                        expect(udp instanceof $.Origin.Stream.Stream.UDP.Configuration).toEqual(
                            true,
                        );
                        expect(udp.configuration.multicast.length).toEqual(1);
                    },
                },
                {
                    action: () => {
                        const udp = observe.origin.as<$.Origin.Stream.Stream.UDP.Configuration>(
                            $.Origin.Stream.Stream.UDP.Configuration,
                        ) as $.Origin.Stream.Stream.UDP.Configuration;
                        expect(udp instanceof $.Origin.Stream.Stream.UDP.Configuration).toEqual(
                            true,
                        );
                        udp.configuration.multicast[0].multiaddr = '0.0.0.0';
                    },
                    check: () => {
                        const udp = observe.origin.as<$.Origin.Stream.Stream.UDP.Configuration>(
                            $.Origin.Stream.Stream.UDP.Configuration,
                        ) as $.Origin.Stream.Stream.UDP.Configuration;
                        expect(udp instanceof $.Origin.Stream.Stream.UDP.Configuration).toEqual(
                            true,
                        );
                        expect(udp.configuration.multicast[0].multiaddr).toEqual('0.0.0.0');
                    },
                },
                {
                    action: () => {
                        const udp = observe.origin.as<$.Origin.Stream.Stream.UDP.Configuration>(
                            $.Origin.Stream.Stream.UDP.Configuration,
                        ) as $.Origin.Stream.Stream.UDP.Configuration;
                        expect(udp instanceof $.Origin.Stream.Stream.UDP.Configuration).toEqual(
                            true,
                        );
                        udp.configuration.multicast.splice(0, 1);
                    },
                    check: () => {
                        const udp = observe.origin.as<$.Origin.Stream.Stream.UDP.Configuration>(
                            $.Origin.Stream.Stream.UDP.Configuration,
                        ) as $.Origin.Stream.Stream.UDP.Configuration;
                        expect(udp instanceof $.Origin.Stream.Stream.UDP.Configuration).toEqual(
                            true,
                        );
                        expect(udp.configuration.multicast.length).toEqual(0);
                    },
                },
            ];
            let currentAction = -1;
            const next = () => {
                currentAction += 1;
                if (currentAction >= actions.length) {
                    finish(undefined, done);
                    return;
                }
                actions[currentAction].action();
            };
            next();
        });
    });

    it(config.regular.list[6], function () {
        return runners.noSession(config.regular, 6, async (logger, done) => {
            const observe = new Factory.Stream().asText().serial().get();
            checkContext(observe, { file: false, concat: false, stream: true });
            const serial = observe.origin.as<$.Origin.Stream.Stream.Serial.Configuration>(
                $.Origin.Stream.Stream.Serial.Configuration,
            ) as $.Origin.Stream.Stream.Serial.Configuration;
            expect(serial instanceof $.Origin.Stream.Stream.Serial.Configuration).toEqual(true);
            expect(typeof serial.configuration.path).toEqual('string');
            const initial = $.Origin.Stream.Stream.Serial.Configuration.initial();
            initial.path = '/dev/test';
            serial.overwrite(initial);
            expect(typeof serial.configuration.path).toEqual('string');
            expect(serial.configuration.path).toEqual('/dev/test');
            const stream = observe.origin.as<$.Origin.Stream.Configuration>(
                $.Origin.Stream.Configuration,
            ) as $.Origin.Stream.Configuration;
            expect(stream instanceof $.Origin.Stream.Configuration).toEqual(true);
            stream.change(
                new $.Origin.Stream.Stream.Process.Configuration(
                    $.Origin.Stream.Stream.Process.Configuration.initial(),
                    undefined,
                ),
            );
            const process = observe.origin.as<$.Origin.Stream.Stream.Process.Configuration>(
                $.Origin.Stream.Stream.Process.Configuration,
            ) as $.Origin.Stream.Stream.Process.Configuration;
            expect(process instanceof $.Origin.Stream.Stream.Process.Configuration).toEqual(true);
            const params = $.Origin.Stream.Stream.Process.Configuration.initial();
            params.command = 'test';
            process.overwrite(params);
            expect(typeof process.configuration.command).toEqual('string');
            expect(process.configuration.command).toEqual('test');
            finish(undefined, done);
        });
    });
});
