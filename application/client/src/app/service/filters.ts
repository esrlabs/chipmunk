import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from '@platform/entity/service';
import { services } from '@register/services';
import { bridge } from '@service/bridge';
import { session } from '@service/session';
// import { error } from '@platform/env/logger';
import { Collection } from './filters/collection';
// import { FilterRequest } from './session/dependencies/search/filters/request';

// const STORAGE_KEY = 'recent_used_filters';

@DependOn(bridge)
@DependOn(session)
@SetupService(services['filters'])
export class Service extends Implementation {
    public collections: Map<string, Collection<any>> = new Map();
}
export interface Service extends Interface {}
export const filters = register(new Service());
