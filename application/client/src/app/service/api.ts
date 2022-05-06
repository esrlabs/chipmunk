import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { Transport } from '@platform/ipc/transport/index';
import { Implementation as ElectronTransport } from './api/transport/electron';
import { services } from '@register/services';
import { scope } from '@platform/env/scope';

@SetupService(services['api'])
export class Service extends Implementation {
    private _transport: Transport = new ElectronTransport();

    public override init(): Promise<void> {
        scope.setTransport(this._transport);
        return Promise.resolve();
    }
}
export interface Service extends Interface {}
export const production = register(new Service());
