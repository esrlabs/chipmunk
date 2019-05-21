import Emitter from "../platform/cross/src/emitter";
import Spawn from "../platform/node/src/process.spawn";

enum EState {
    working = 0,
    waining = 1,
}

export default class TypeScriptCompiler extends Emitter {

    public static Events = {
        error   : Symbol(),
        logs    : Symbol(),
        success : Symbol(),
    };

    private state: EState = EState.waining;

    constructor() {
        super();
    }

    public compiler(folder: string, tsConfigFile: string = ''): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.state === EState.working) {
                return reject(new Error(`Previous process isn't finished yet.`));
            }
            const spawn: Spawn = new Spawn();
            // Bind with events
            spawn.subscribe(Spawn.Events.error, (error: Error) => {
                this.emit(TypeScriptCompiler.Events.error, error);
                if (this.state === EState.working) {
                    spawn.kill();
                    this.state = EState.waining;
                    reject(error);
                }
            });
            spawn.subscribe(Spawn.Events.stream, (str: string) => {
                this.emit(TypeScriptCompiler.Events.logs, str);
            });
            // Check config file
            tsConfigFile = tsConfigFile === '' ? './tsconfig.json' : tsConfigFile;
            // Execute compiler
            spawn.execute({
                command: `tsc -p ${tsConfigFile}`,
                getOriginalEnvVars: ['PATH'],
                options: {
                    cwd: folder,
                },
            }).then(() => {
                resolve();
            }).catch((error: Error) => {
                this.emit(TypeScriptCompiler.Events.error, error);
                if (this.state === EState.working) {
                    this.state = EState.waining;
                    reject(error);
                }
            });
        });

    }

}
