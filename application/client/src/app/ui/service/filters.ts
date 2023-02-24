import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { Subject } from '@platform/env/subscription';

@SetupService(ui['filters'])
export class Service extends Implementation {
    public readonly updated: Subject<void> = new Subject();
    protected filters: string[] = [];

    public override destroy(): Promise<void> {
        this.updated.destroy();
        return Promise.resolve();
    }

    public add(uuid: string) {
        !this.filters.includes(uuid) && this.filters.push(uuid);
        this.updated.emit();
    }

    public remove(uuid: string) {
        this.filters = this.filters.filter((f) => f !== uuid);
        this.updated.emit();
    }

    public isEnabled(uuid: string): boolean {
        return this.filters.length === 0 ? false : this.filters[this.filters.length - 1] === uuid;
    }
}

export interface Service extends Interface {}
export const filters = register(new Service());
