// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Components } from '../src/index';
import { readConfigurationFile } from './config';
import { finish } from './common';
import { SourceOrigin } from 'platform/types/bindings';

import * as runners from './runners';

const config = readConfigurationFile().get().tests.components;

describe('Jobs', function () {
    it(config.regular.list[1], function () {
        return runners.unbound(config.regular, 1, async (logger, done, collector) => {
            const components = new Components(async (err: Error | undefined) => {
                if (err instanceof Error) {
                    return finish([], done, err);
                }
                let parsers = await components.get({ File: 'somefile' }).parsers();
                let sources = await components.get({ File: 'somefile' }).sources();
                console.log(parsers);
                console.log(sources);
                components
                    .getOptions(
                        '05050505-0505-0505-0505-050505050505',
                        '01010101-0101-0101-0101-010101010101',
                        { File: 'somefile' },
                    )
                    .then((fields) => {
                        console.log(JSON.stringify(fields));
                        components
                            .destroy()
                            .then(() => {
                                setTimeout(() => {
                                    finish([], done);
                                }, 1000);
                            })
                            .catch((err) => {
                                finish([], done, err);
                            });
                    })
                    .catch((err) => {
                        finish([], done, err);
                    });
            });
        });
    });
});
