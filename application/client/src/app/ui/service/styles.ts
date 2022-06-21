import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';

export type RemoveHandler = () => void;

@SetupService(ui['styles'])
export class Service extends Implementation {
    private _sheet!: CSSStyleSheet;

    public override init(): Promise<void> {
        const style = document.createElement('style') as HTMLStyleElement;
        document.head.appendChild(style);
        if (style.sheet === null) {
            return Promise.reject(new Error(`Fail to create global style sheet`));
        }
        this._sheet = style.sheet;
        return Promise.resolve();
    }

    public add(rule: string): RemoveHandler {
        const index = this._sheet.insertRule(rule);
        return () => {
            this._sheet.deleteRule(index);
        };
    }
}

export interface Service extends Interface {}
export const styles = register(new Service());
