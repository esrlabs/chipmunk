export interface IDebugSettings {
    initChannelDelay: number, // {ms} Delay between creating channel and sending event "ready"
}

export class ServiceProduction {
    
    public isProd(): boolean {
        return false;
    }

    public getDebugSettings(): IDebugSettings {
        return {
            initChannelDelay: 250
        }
    }

}

export default new ServiceProduction();