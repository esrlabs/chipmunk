import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { bridge } from '@service/bridge';
import { ilc } from '@service/ilc';

export type RemoveHandler = () => void;

const COLOR_THEME_KEY = 'color_theme_settings';

type Theme = 'dark-theme' | 'light-theme';

@SetupService(ui['styles'])
export class Service extends Implementation {
    protected _sheet!: CSSStyleSheet;
    protected _theme: Theme = 'dark-theme';

    public override init(): Promise<void> {
        const style = document.createElement('style') as HTMLStyleElement;
        document.head.appendChild(style);
        if (style.sheet === null) {
            return Promise.reject(new Error(`Fail to create global style sheet`));
        }
        this._sheet = style.sheet;
        ilc.channel(this.getName(), this.log()).system.ready(() => {
            this.theme().load();
        });

        return Promise.resolve();
    }

    public add(rule: string): RemoveHandler {
        const index = this._sheet.insertRule(rule);
        return () => {
            this._sheet.deleteRule(index);
        };
    }

    public theme(): {
        dark(): void;
        light(): void;
        load(): void;
        save(): void;
        apply(): void;
    } {
        return {
            dark: (): void => {
                this._theme = 'dark-theme';
                this.theme().apply();
            },
            light: (): void => {
                this._theme = 'light-theme';
                this.theme().apply();
            },
            load: (): void => {
                bridge
                    .storage(COLOR_THEME_KEY)
                    .read()
                    .then((theme: string) => {
                        if (theme !== 'dark-theme' && theme !== 'light-theme') {
                            this._theme = 'dark-theme';
                            this.theme().save();
                        } else {
                            this._theme = theme;
                        }
                        this.theme().apply();
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to load theme: ${err.message}`);
                        this.theme().save();
                    });
            },
            save: (): void => {
                bridge
                    .storage(COLOR_THEME_KEY)
                    .write(this._theme)
                    .catch((err: Error) => {
                        this.log().error(`Fail to save theme: ${err.message}`);
                    });
            },
            apply: () => {
                if (this._theme !== 'dark-theme' && this._theme !== 'light-theme') {
                    this._theme = 'dark-theme';
                }
                document.body.className = this._theme;
                this.theme().save();
            },
        };
    }
}

export interface Service extends Interface {}
export const styles = register(new Service());
