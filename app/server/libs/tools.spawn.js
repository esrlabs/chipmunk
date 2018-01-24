const EVENTS = {
    exit        : 'exit',
    error       : 'error',
    close       : 'close',
    disconnect  : 'disconnect',
    data        : 'data',
    done        : 'done'
};

const logger        = new (require('./tools.logger'))('SpawnWrapper');
const util          = require('util');
const spawn         = require('child_process').spawn;
const EventEmitter  = require('events').EventEmitter;

class SpawnWrapper extends EventEmitter{

    constructor(){
        super();
        this._spawn         = null;
        this._destroy       = this._destroy.bind(this);
        this._onError       = this._onError.bind(this);
        this._onClose       = this._onClose.bind(this);
        this._onDisconnect  = this._onDisconnect.bind(this);
        this._onExit        = this._onExit.bind(this);
        this._onData        = this._onData.bind(this);
        this.EVENTS         = EVENTS;
    }

    execute(command, params, env = null){
        env === null && (env = process.env);
        return new Promise((resolve, reject) => {
            if (this._spawn !== null) {
                return reject(new Error(`Spawn already executed and wasn't finished yet.`));
            }
            try {
                this._spawn = spawn(command, params, {
                    env: env !== null ? env : process.env
                });
                if (this._spawn !== null && (typeof this._spawn.pid !== 'number' || this._spawn.pid <= 0)){
                    this._destroy();
                    return reject(new Error(logger.error(`Fail to execute command: ${util.inspect(command)}, params: ${util.inspect(params)}, env: ${util.inspect(env)}`)));
                }
                this._bind();
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    _onError(error, ...args){
        this.emit(EVENTS.error, error, ...args);
        this._destroy();
    }

    _onClose(...args){
        this.emit(EVENTS.close, ...args);
        this._destroy();
    }

    _onDisconnect(...args){
        this.emit(EVENTS.disconnect, ...args);
        this._destroy();
    }

    _onExit(...args){
        this.emit(EVENTS.exit, ...args);
        this._destroy();
    }

    _onData(...args){
        this.emit(EVENTS.data, ...args);
    }

    _bind(){
        if (this._spawn !== null){
            this._spawn.on(EVENTS.error,        this._onError);
            this._spawn.on(EVENTS.close,        this._onClose);
            this._spawn.on(EVENTS.disconnect,   this._onDisconnect);
            this._spawn.on(EVENTS.exit,         this._onExit);
            this._spawn.stdout.on(EVENTS.data,  this._onData);
            process.on(EVENTS.exit,             this._destroy);
        }
    }

    _unbind(){
        if (this._spawn !== null){
            this._spawn.removeAllListeners(         EVENTS.error);
            this._spawn.removeAllListeners(         EVENTS.close);
            this._spawn.removeAllListeners(         EVENTS.disconnect);
            this._spawn.removeAllListeners(         EVENTS.exit);
            this._spawn.stdout.removeAllListeners(  EVENTS.data);
            process.removeListener(                 EVENTS.exit, this._destroy);
        }
    }

    _destroy() {
        this._unbind();
        this._spawn !== null && this._spawn.kill();
        this._spawn  = null;
        this.emit(EVENTS.done);
    }

    kill(){
        this._destroy();
    }
}

module.exports = SpawnWrapper;