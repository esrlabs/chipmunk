import * as obj from 'platform/env/obj';
import { Implementation } from '@controller/settings';

export interface Window {
    width: number;
    height: number;
    x: number;
    y: number;
}

export class Settings extends Implementation<Window> {
    private _settings: Window = {
        width: 800,
        height: 600,
        x: 100,
        y: 100,
    };
    public fromString(content: string): Promise<void> {
        try {
            const settings = JSON.parse(content);
            obj.isObject(settings);
            this._settings.width = obj.getAsValidNumber(settings, 'width', { min: 100 });
            this._settings.height = obj.getAsValidNumber(settings, 'height', { min: 100 });
            this._settings.x = obj.getAsValidNumber(settings, 'x', { min: 0 });
            this._settings.y = obj.getAsValidNumber(settings, 'y', { min: 0 });
            return Promise.resolve();
        } catch (e) {
            return Promise.reject(
                new Error(this.log().error(`Fail to read settings from string: ${content}`)),
            );
        }
    }
    public asString(): string {
        return JSON.stringify(this._settings);
    }
    public get(): Window {
        return this._settings;
    }
    public set(settings: Window) {
        this._settings = settings;
    }
    public getAlias(): string {
        return 'Window';
    }
}
