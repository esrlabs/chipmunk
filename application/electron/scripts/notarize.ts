// tslint:disable-next-line:no-var-requires
require("dotenv").config();
import { notarize, NotarizeStartOptions } from "electron-notarize";

export default async function notarizing(context: any): Promise<void> {
    const { electronPlatformName, appOutDir } = context;
    if (electronPlatformName !== "darwin") {
        return;
    }
    const skipNotarize = process.env.SKIP_NOTARIZE;
    if (skipNotarize !== "true") {
        // tslint:disable-next-line:no-console
        console.log("trying to notarize");

        const appName = context.packager.appInfo.productFilename;
        const appleIdPassword = process.env.APPLEIDPASS;
        const appleId = process.env.APPLEID;
        if (appleIdPassword === undefined) {
            // tslint:disable-next-line:no-console
            console.log("no APPLEIDPASS found => aborting notarize");
            return Promise.resolve();
            // throw Error("no appleIdPassword in envirmonment");
        }
        if (appleId === undefined) {
            // tslint:disable-next-line:no-console
            console.log("no APPLEID in envirmonment => aborting notarize");
            return Promise.resolve();
        }
        const v: NotarizeStartOptions = {
            appBundleId: "com.esrlabs.chipmunk",
            appPath: `${appOutDir}/${appName}.app`,
            appleId,
            appleIdPassword,
        };
        return await notarize(v);
    } else {
        // tslint:disable-next-line:no-console
        console.log("skipping notarize");
    }
}
