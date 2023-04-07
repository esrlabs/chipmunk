import { decoratorFactory, DecoratorConstructor } from '../env/decorators';
import { scope } from '../env/scope';
import { Logger } from '../log';

export interface LoggerInterface {
    getLoggerName(): string;
    setLoggerName(name: string): string;
    log(): Logger;
}

export const SetupLogger = decoratorFactory(
    (constructor: DecoratorConstructor, defaults?: string | void) => {
        let alias = defaults === undefined ? 'noname' : defaults;
        return class extends constructor {
            __name: string = alias;
            __logger: Logger = scope.getLogger(alias);
            public getLoggerName(): string {
                if (this === undefined || this.__name === undefined) {
                    throw new Error(`Entity ${alias} isn't inited`);
                }
                return this.__name;
            }
            public setLoggerName(name: string): void {
                if (this === undefined) {
                    throw new Error(`Entity ${alias} isn't inited`);
                }
                alias = name;
                this.__name = name;
                this.__logger = scope.getLogger(name);
            }
            public log(): Logger {
                if (this === undefined || this.__logger === undefined) {
                    throw new Error(`Entity ${alias} isn't inited`);
                }
                return this.__logger;
            }
        };
    },
);
