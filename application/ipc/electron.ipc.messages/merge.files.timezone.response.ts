
export interface IMergeFilestimezoneResponse {
    zones: string[];
}

export class MergeFilestimezoneResponse {

    public static signature: string = 'MergeFilestimezoneResponse';
    public signature: string = MergeFilestimezoneResponse.signature;
    public zones: string[] = [];

    constructor(params: IMergeFilestimezoneResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for MergeFilestimezoneResponse message`);
        }
        if (params.zones !== undefined && !(params.zones instanceof Array)) {
            throw new Error(`zones should be defined as Array<string>.`);
        }
        this.zones = params.zones;
    }

}
