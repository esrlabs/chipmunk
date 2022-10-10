import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';

export enum Platform {
    darwin = 'darwin',
    windows = 'windows',
    linux = 'linux',
}

function isMatch(src: string, hooks: string[]): boolean {
    return hooks.filter((h) => src.includes(h)).length > 0;
}

@SetupService(services['env'])
export class Service extends Implementation {
    private _platform!: Platform;

    public override ready(): Promise<void> {
        const userAgentData = (navigator as any).userAgentData;
        if (userAgentData !== undefined && typeof userAgentData.platform === 'string') {
            const platform = userAgentData.platform.toLowerCase();
            if (isMatch(platform, ['windows'])) {
                this._platform = Platform.windows;
            } else if (isMatch(platform, ['darwin', 'macos', 'mac os', 'mac'])) {
                this._platform = Platform.darwin;
            } else if (isMatch(platform, ['linux'])) {
                this._platform = Platform.linux;
            }
        }
        if (this._platform === undefined) {
            this.log().warn(`Fail to detect platform on browser level`);
        } else {
            this.log().debug(`Platform: ${this._platform}`);
        }
        return Promise.resolve();
    }

    public platform(): {
        darwin(): boolean;
        windows(): boolean;
        linux(): boolean;
    } {
        return {
            darwin: (): boolean => {
                return this._platform === Platform.darwin;
            },
            windows: (): boolean => {
                return this._platform === Platform.windows;
            },
            linux: (): boolean => {
                return this._platform === Platform.linux;
            },
        };
    }
}
export interface Service extends Interface {}
export const env = register(new Service());
