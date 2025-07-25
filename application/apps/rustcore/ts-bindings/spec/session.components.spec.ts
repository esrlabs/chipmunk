// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Components } from '../src/index';
import { readConfigurationFile } from './config';
import { finish } from './common';
import { SessionAction, FieldDesc, LazyFieldDesc, StaticFieldDesc } from 'platform/types/bindings';

import * as runners from './runners';
import { error } from 'platform/log/utils';
import { LoadingDoneEvent } from '../src/api/components.provider';

const config = readConfigurationFile().get().tests.components;

const TCP_SOURCE_UUID: string = '05050505-0505-0505-0505-050505050505';
const DLT_PARSER_UUID: string = '01010101-0101-0101-0101-010101010101';
const SOMEIP_PARSER_UUID: string = '02020202-0202-0202-0202-020202020202';

describe('Jobs', function () {
    it(config.regular.list[1], function () {
        return runners.unbound(config.regular, 1, async (logger, done, collector) => {
            try {
                const components = collector(await Components.create()) as Components;
                const origin: SessionAction = { File: 'somefile' };
                // Request available parsers and sources
                let parsers = await components.get(origin).parsers();
                let sources = await components.get(origin).sources();
                if (!parsers.find((ident) => ident.uuid === DLT_PARSER_UUID)) {
                    return finish(
                        [components],
                        done,
                        new Error(`Fail to find DLT parser by uuid: ${DLT_PARSER_UUID}`),
                    );
                }
                if (!sources.find((ident) => ident.uuid === TCP_SOURCE_UUID)) {
                    return finish(
                        [components],
                        done,
                        new Error(`Fail to find DLT parser by uuid: ${TCP_SOURCE_UUID}`),
                    );
                }
                // Subscribe to events
                let received_lazy: StaticFieldDesc[] | undefined = undefined;
                components.getEvents().LoadingDone.subscribe((event: LoadingDoneEvent) => {
                    received_lazy = event.fields;
                });
                // Request options scheme
                const fields = await components.getOptions(origin, [
                    TCP_SOURCE_UUID,
                    DLT_PARSER_UUID,
                ]);
                const dlt_opts: FieldDesc[] | undefined = fields.options.get(DLT_PARSER_UUID);
                if (!dlt_opts) {
                    return finish([components], done, new Error(`No fields from DLT parser`));
                }
                const lazy_field: { Lazy: LazyFieldDesc } | undefined = dlt_opts.find(
                    (field: FieldDesc) => 'Lazy' in field,
                );
                if (!lazy_field) {
                    return finish([components], done, new Error(`No lazy fields from DLT parser`));
                }
                // Do not wait for field
                components.abort([lazy_field.Lazy.id]);
                setTimeout(() => {
                    if (received_lazy !== undefined) {
                        finish(
                            [components],
                            done,
                            new Error(
                                `Lazy options received, but should not: ${JSON.stringify(
                                    received_lazy,
                                )}`,
                            ),
                        );
                    } else {
                        // We are good
                        finish([components], done);
                    }
                }, 2000);
            } catch (err) {
                finish([], done, new Error(error(err)));
            }
        });
    });

    it(config.regular.list[2], function () {
        return runners.unbound(config.regular, 2, async (logger, done, collector) => {
            try {
                const components = collector(await Components.create()) as Components;
                const origin: SessionAction = { File: 'somefile' };
                // Request available parsers and sources
                let parsers = await components.get(origin).parsers();
                let sources = await components.get(origin).sources();
                if (!parsers.find((ident) => ident.uuid === SOMEIP_PARSER_UUID)) {
                    return finish(
                        [components],
                        done,
                        new Error(`Fail to find DLT parser by uuid: ${SOMEIP_PARSER_UUID}`),
                    );
                }
                if (!sources.find((ident) => ident.uuid === TCP_SOURCE_UUID)) {
                    return finish(
                        [components],
                        done,
                        new Error(`Fail to find DLT parser by uuid: ${TCP_SOURCE_UUID}`),
                    );
                }
                // Subscribe to events
                let received_lazy: StaticFieldDesc[] | undefined = undefined;
                components.getEvents().LoadingDone.subscribe((event: LoadingDoneEvent) => {
                    received_lazy = event.fields;
                });
                // Request options scheme
                const fields = await components.getOptions(origin, [
                    TCP_SOURCE_UUID,
                    DLT_PARSER_UUID,
                ]);
                const dlt_opts: FieldDesc[] | undefined = fields.options.get(DLT_PARSER_UUID);
                if (!dlt_opts) {
                    return finish([components], done, new Error(`No fields from DLT parser`));
                }
                const lazy_field: { Lazy: LazyFieldDesc } | undefined = dlt_opts.find(
                    (field: FieldDesc) => 'Lazy' in field,
                );
                if (!lazy_field) {
                    return finish([components], done, new Error(`No lazy fields from DLT parser`));
                }
                setTimeout(() => {
                    if (received_lazy === undefined) {
                        // We are good
                        finish([components], done);
                    } else {
                        // We didn't get lazy options
                        finish([components], done, new Error(`Lazy options not received`));
                    }
                }, 1000);
            } catch (err) {
                finish([], done, new Error(error(err)));
            }
        });
    });
});
