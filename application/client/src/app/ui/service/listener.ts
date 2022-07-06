import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { IOptions } from './listener/options';
import { Target, getTargetUuid, ITarget } from './listener/target';
import { Subscription } from '@platform/env/subscription';

@SetupService(ui['listener'])
export class Service extends Implementation {
    protected targets: Map<string, Target> = new Map();

    public override ready(): Promise<void> {
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.targets.forEach((target) => target.destroy());
        return Promise.resolve();
    }

    public listen<T>(
        event: string,
        target: ITarget,
        handler: (event: T) => boolean,
        options?: IOptions,
    ): Subscription {
        const uuid = getTargetUuid(target);
        let holder: Target | undefined = undefined;
        if (uuid === undefined) {
            holder = new Target(target);
            this.targets.set(holder.uuid, holder);
        } else {
            holder = this.targets.get(uuid);
        }
        if (holder === undefined) {
            throw new Error(`Fail to recognise target`);
        }
        if (event.trim() === '') {
            throw new Error(`Event name isn't defined`);
        }
        return holder.listen(event, handler, options);
    }
}
export interface Service extends Interface {}
export const listener = register(new Service());
