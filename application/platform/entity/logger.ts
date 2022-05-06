import { singleDecoratorFactory, DecoratorConstructor } from '../env/decorators';
import { scope } from '../env/scope';
import { Instance as Logger } from '../env/logger';

export interface LoggerInterface {
    getLoggerName(): string;
    setLoggerName(name: string): string;
    log(): Logger;
}

export const SetupLogger = singleDecoratorFactory((constructor: DecoratorConstructor) => {
    let alias = 'noname';
    const logger = scope.getLogger(alias);
    return class extends constructor {
        __name: string = alias;
        __logger: Logger = logger;
        public getLoggerName(): string {
            if (this === undefined || this.__name === undefined) {
                throw new Error(`Entity ${alias} isn't inited`);
            }
            return this.__name;
        }
        public setLoggerName(name: string): void {
            if (this === undefined || this.__name === undefined) {
                throw new Error(`Entity ${alias} isn't inited`);
            }
            alias = name;
            this.__logger.rename(name);
        }
        public log(): Logger {
            if (this === undefined || this.__logger === undefined) {
                throw new Error(`Entity ${alias} isn't inited`);
            }
            return this.__logger;
        }
    };
});
