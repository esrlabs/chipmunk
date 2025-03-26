import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { electron } from '@service/electron';

@DependOn(electron)
@SetupService(services['components'])
export class Service extends Implementation {}
export interface Service extends Interface {}
export const components = register(new Service());
