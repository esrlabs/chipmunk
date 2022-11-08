import { v4 } from 'uuid';
import { setUuidGenerator } from 'platform/env/sequence';

import * as path from 'path';
import * as Logs from '../util/logging';

export interface IRustModuleExports {
    RustSession: any;
    Dlt: any;
    Serial: any;
    Files: any;
    execute: (filename: string, args: string[]) => Promise<void>;
}

export function getNativeModule(): IRustModuleExports {
    const modulePath = path.resolve(module.path, './index.node');
    Logs.getLogger('Native module getter').verbose(`Target: ${modulePath}`);
    return require(modulePath);
}

const { RustSession: RustSessionNoType, Dlt: RustDltTools } = getNativeModule();

export { RustSessionNoType, RustDltTools };

setUuidGenerator(v4);
