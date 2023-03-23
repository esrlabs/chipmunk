import { Destroy } from '@env/declarations';

export abstract class Base implements Destroy {
    public quicksetup: boolean = false;

    public toggleQuickSetup(quicksetup?: boolean) {
        if (quicksetup !== undefined) {
            this.quicksetup = quicksetup;
        } else {
            this.quicksetup = !this.quicksetup;
        }
    }

    public destroy(): void {
        //
    }

    public abstract key(): string;
}
