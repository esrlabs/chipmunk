/**
 * @module init
 * @description Module should be load at veery first place. This module is right place to put any init procedures
 */
import { setUuidGenerator } from '@platform/env/sequence';
import { scope } from '@platform/env/scope';
import { v4 } from 'uuid';
import { Logger } from '@env/logs/index';

// Set globals on @platform
// Set uuid getter
setUuidGenerator(v4);
// Set logger getter
scope.setLogger(Logger);

// Import list of services
import '@register/services';
