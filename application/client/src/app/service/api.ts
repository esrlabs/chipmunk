import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { Transport } from '@platform/ipc/transport/index';
import { Implementation as ElectronTransport } from './api/transport/electron';
import { services } from '@register/services';
import { scope } from '@platform/env/scope';
import { Logger } from '@env/logs/index';

@SetupService(services['api'])
export class Service extends Implementation {
    private _transport: Transport = new ElectronTransport();

    public override init(): Promise<void> {
        scope.setTransport(this._transport);
        Logger.backend().allow();
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        Logger.backend().disallow();
        this._transport.destroy();
        return Promise.resolve();
    }

    public transport(): Transport {
        return this._transport;
    }
}
export interface Service extends Interface {}
export const api = register(new Service());
