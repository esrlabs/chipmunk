import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from '@platform/entity/service';
import { services } from '@register/services';
import { ilc, Emitter, Services, Declarations } from '@service/ilc';
import { Subscriber } from '@platform/env/subscription';
import * as Events from '@platform/ipc/event/index';

@SetupService(services['recent'])
export class Service extends Implementation {}
export interface Service extends Interface {}
export const state = register(new Service());
