// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();

import { finish, runner } from './common';
import { readConfigurationFile } from './config';

import * as proto from 'protocol';
import * as $ from 'platform/types/observe';
import * as Types from '../src/protocol';

const config = readConfigurationFile().get().tests.protocol;

describe('Protocol', function () {
    it(config.regular.list[1], function () {
        return runner(config.regular, 1, async (logger, done, collector) => {
            let observe = Types.toObserveOptions({
                origin: { File: ['somefile', $.Types.File.FileType.Text, 'path_to_file'] },
                parser: { Text: null },
            });
            let buf = proto.ObserveOptions.encode(observe);
            console.log(buf);
            let decoded = proto.ObserveOptions.decode(buf);
            console.log(decoded.origin.origin.File);
            finish(undefined, done);
        });
    });
});
