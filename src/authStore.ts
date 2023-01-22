import fs from "fs";
import { Response } from "node-fetch";
import path from "path";
import { Cookie } from "tough-cookie";
import { iCloudServiceSetupOptions } from ".";
import { AUTH_HEADERS, DEFAULT_HEADERS } from "./consts";

export default class iCloudAuthenticationStore {
    options: iCloudServiceSetupOptions;
    tknFile: string;


    trustToken?: string;
    sessionId?: string;
    sessionToken?: string;
    scnt?: string;
    aasp?: string;
    icloudCookies: Cookie[];

    constructor(options: iCloudServiceSetupOptions) {
        this.options = options;
        this.tknFile = path.format({ dir: options.dataDirectory, base: ".trust-token" });

        Object.defineProperty(this, "trustToken", { enumerable: false });
        Object.defineProperty(this, "sessionId", { enumerable: false });
        Object.defineProperty(this, "sessionToken", { enumerable: false });
        Object.defineProperty(this, "scnt", { enumerable: false });
        Object.defineProperty(this, "aasp", { enumerable: false });
        Object.defineProperty(this, "icloudCookies", { enumerable: false });
    }

    loadTrustToken(account: string) {
        try {
            this.trustToken = fs.readFileSync(this.tknFile + "-" + Buffer.from(account.toLowerCase()).toString("base64"), "utf8");
        } catch (e) {
            console.debug("[icloud] Unable to load trust token:", e.toString());
        }
    }
    writeTrustToken(account: string) {
        try {
            if (!fs.existsSync(this.options.dataDirectory)) fs.mkdirSync(this.options.dataDirectory);
            require("fs").writeFileSync(this.tknFile + "-" + Buffer.from(account.toLowerCase()).toString("base64"), this.trustToken);
        } catch (e) {
            console.warn("[icloud] Unable to write trust token:", e.toString());
        }
    }



    processAuthSecrets(authResponse: Response) {
        try {
            this.sessionId = authResponse.headers.get("X-Apple-Session-Token");
            this.sessionToken = this.sessionId;
            this.scnt = authResponse.headers.get("scnt");

            const headers = Array.from(authResponse.headers.values());
            const aaspCookie = headers.find((v) => v.includes("aasp="));
            this.aasp = aaspCookie.split("aasp=")[1].split(";")[0];
            return this.validateAuthSecrets();
        } catch (e) {
            console.warn("[icloud] Unable to process auth secrets:", e.toString());
            return false;
        }
    }
    processCloudSetupResponse(cloudSetupResponse: Response) {
        this.icloudCookies = Array.from(cloudSetupResponse.headers.entries())
            .filter((v) => v[0].toLowerCase() == "set-cookie")
            .map((v) => v[1].split(", "))
            .reduce((a, b) => a.concat(b), [])
            .map((v) => Cookie.parse(v))
            .filter((v) => !!v);
        return !!this.icloudCookies.length;
    }
    processAccountTokens(account:string, trustResponse: Response) {
        this.sessionToken = trustResponse.headers.get("x-apple-session-token");
        this.trustToken = trustResponse.headers.get("x-apple-twosv-trust-token");
        this.writeTrustToken(account);
        return this.validateAccountTokens();
    }
    addCookies(cookies: string[]) {
        cookies.map((v) => Cookie.parse(v)).forEach((v) => this.icloudCookies.push(v));
    }

    getMfaHeaders() {
        return { ...AUTH_HEADERS, scnt: this.scnt, "X-Apple-ID-Session-Id": this.sessionId, Cookie: "aasp=" + this.aasp };
    }
    getHeaders() {
        return { ...DEFAULT_HEADERS, Cookie: this.icloudCookies.filter((a) => a.value).map((cookie) => cookie.cookieString()).join("; ") };
    }

    validateAccountTokens() {
        return this.sessionToken && this.trustToken;
    }
    validateAuthSecrets() {
        return this.aasp && this.scnt && this.sessionId;
    }
}