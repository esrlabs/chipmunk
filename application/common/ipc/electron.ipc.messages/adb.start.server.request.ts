export interface IAdbStartServerRequest {
  guid: string;
}

export class AdbStartServerRequest {
  public static signature: string = "AdbStartServerRequest";
  public signature: string = AdbStartServerRequest.signature;
  public guid: string;

  constructor(params: IAdbStartServerRequest) {
    if (typeof params !== "object" || params === null) {
      throw new Error(`Incorrect parameters for AdbStartServerRequest message`);
    }
    if (typeof params.guid !== "string" || params.guid.trim() === "") {
      throw new Error(`Field "guid" should be defined`);
    }
    this.guid = params.guid;
  }
}
