export interface IAdbStartServerResponse {
  guid: string;
  error?: string;
}

export class AdbStartServerResponse {
  public static signature: string = "AdbStartServerResponse";
  public signature: string = AdbStartServerResponse.signature;
  public guid: string;
  public error?: string;

  constructor(params: IAdbStartServerResponse) {
    if (typeof params !== "object" || params === null) {
      throw new Error(
        `Incorrect parameters for AdbStartServerResponse message`
      );
    }
    if (typeof params.guid !== "string" || params.guid.trim() === "") {
      throw new Error(`Expecting guid to be a string`);
    }
    if (
      params.error !== undefined &&
      (typeof params.error !== "string" || params.error.trim() === "")
    ) {
      throw new Error(`Expecting error to be a string`);
    }
    this.guid = params.guid;
    this.error = params.error;
  }
}
