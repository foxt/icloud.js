import EventEmitter from "events";
import fs from "fs";
import fetch from "node-fetch";
import os from "os";
import path from "path";
import iCloudAuthenticationStore from "./authStore";
import { AUTH_ENDPOINT, AUTH_HEADERS, DEFAULT_HEADERS, SETUP_ENDPOINT } from "./consts";
import { iCloudAccountDetailsService } from "./services/account";
import { iCloudCalendarService } from "./services/calendar";
import { iCloudDriveService } from "./services/drive";
import { iCloudFindMyService } from "./services/findMy";
import { iCloudPhotosService } from "./services/photos";
import { iCloudUbiquityService } from "./services/ubiquity";
import { AccountInfo } from "./types";


export interface iCloudServiceSetupOptions {
    username?: string;
    password?: string;
    saveCredentials?: boolean;
    trustDevice?: boolean;
    dataDirectory?: string;
}

export const enum iCloudServiceStatus {
    NotStarted = "NotStarted",
    Started = "Started",
    MfaRequested = "MfaRequested",
    Authenticated = "Authenticated",
    Trusted = "Trusted",
    Ready = "Ready",
    Error = "Error"
}



export interface iCloudStorageUsage {
    storageUsageByMedia: Array<{
      mediaKey: string
      displayLabel: string
      displayColor: string
      usageInBytes: number
    }>
    storageUsageInfo: {
      compStorageInBytes: number
      usedStorageInBytes: number
      totalStorageInBytes: number
      commerceStorageInBytes: number
    }
    quotaStatus: {
      overQuota: boolean
      haveMaxQuotaTier: boolean
      "almost-full": boolean
      paidQuota: boolean
    }
    familyStorageUsageInfo: {
      mediaKey: string
      displayLabel: string
      displayColor: string
      usageInBytes: number
      familyMembers: Array<{
        lastName: string
        dsid: number
        fullName: string
        firstName: string
        usageInBytes: number
        id: string
        appleId: string
      }>
    }
  }


function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export default class iCloudService extends EventEmitter {
    authStore: iCloudAuthenticationStore;
    options: iCloudServiceSetupOptions;

    status: iCloudServiceStatus = iCloudServiceStatus.NotStarted;

    /*
        Has PCS (private/protected cloud service?) enabled.
        The check is implemented by checking if the `isDeviceConsentedForPCS` key is present in the `requestWebAccessState` object.
    */
    pcsEnabled?: boolean;
    /**
     * PCS access is granted.
     */
    pcsAccess?: boolean;
    /**
     * Has ICRS (iCloud Recovery Service) disabled.
     * This should only be true when iCloud Advanced Data Protection is enabled.
     */
    ICDRSDisabled?: boolean;

    accountInfo?: AccountInfo;

    awaitReady = new Promise((resolve, reject) => {
        this.on(iCloudServiceStatus.Ready, resolve);
        this.on(iCloudServiceStatus.Error, reject);
    });

    constructor(options: iCloudServiceSetupOptions) {
        super();
        this.options = options;
        if (!this.options.dataDirectory) this.options.dataDirectory = path.join(os.homedir(), ".icloud");
        this.authStore = new iCloudAuthenticationStore(options);
    }

    private _setState(state: iCloudServiceStatus, ...args: any[]) {
        console.debug("[icloud] State changed to:", state);
        this.status = state;
        this.emit(state, ...args);
    }

    async authenticate(username?: string, password?: string) {
        username = username || this.options.username;
        password = password || this.options.password;

        if (!username) {
            try {
                const saved = (await require("keytar").findCredentials("https://idmsa.apple.com"))[0];
                if (!saved) throw new Error("Username was not provided and could not be found in keychain");
                username = saved.account;
                console.debug("[icloud] Username found in keychain:", username);
            } catch (e) {
                throw new Error("Username was not provided, and unable to use Keytar to find saved credentials" + e.toString());
            }
        }
        if (typeof (username as any) !== "string") throw new TypeError("authenticate(username?: string, password?: string): 'username' was " + (username || JSON.stringify(username)).toString());
        this.options.username = username;
        if (!password) {
            try {
                password = await require("keytar").findPassword("https://idmsa.apple.com", username);
            } catch (e) {
                throw new Error("Password was not provided, and unable to use Keytar to find saved credentials" + e.toString());
            }
        }
        if (typeof (password as any) !== "string") throw new TypeError("authenticate(username?: string, password?: string): 'password' was " + (password || JSON.stringify(password)).toString());
        // hide password from console.log
        Object.defineProperty(this.options, "password", {
            enumerable: false, // hide it from for..in
            value: password
        });
        if (!username) throw new Error("Username is required");
        if (!password) throw new Error("Password is required");


        if (!fs.existsSync(this.options.dataDirectory)) fs.mkdirSync(this.options.dataDirectory);
        this.authStore.loadTrustToken(this.options.username);



        this._setState(iCloudServiceStatus.Started);
        try {
            const authData = { accountName: this.options.username, password: this.options.password, trustTokens: [] };
            if (this.authStore.trustToken) authData.trustTokens.push(this.authStore.trustToken);
            const authResponse = await fetch(AUTH_ENDPOINT + "signin?isRememberMeEnabled=true", { headers: AUTH_HEADERS, method: "POST", body: JSON.stringify(authData) });
            if (authResponse.status == 200) {
                if (this.authStore.processAuthSecrets(authResponse)) {
                    this._setState(iCloudServiceStatus.Trusted);
                    this.getiCloudCookies();
                } else {
                    throw new Error("Unable to process auth response!");
                }
            } else if (authResponse.status == 409) {
                if (this.authStore.processAuthSecrets(authResponse)) {
                    this._setState(iCloudServiceStatus.MfaRequested);
                } else {
                    throw new Error("Unable to process auth response!");
                }
            } else {
                if (authResponse.status == 401) {
                    throw new Error("Recieved 401 error. Incorrect password? (" + authResponse.status + ", " + await authResponse.text() + ")");
                }
                throw new Error("Invalid status code: " + authResponse.status + ", " + await authResponse.text());
            }
        } catch (e) {
            this._setState(iCloudServiceStatus.Error, e);
            throw e;
        }
    }

    async provideMfaCode(code: string) {
        if (typeof (code as any) !== "string") throw new TypeError("provideMfaCode(code: string): 'code' was " + code.toString());
        code = code.replace(/\D/g, "");
        if (code.length !== 6) console.warn("[icloud] Provided MFA wasn't 6-digits!");

        if (!this.authStore.validateAuthSecrets()) {
            throw new Error("Cannot provide MFA code without calling authenticate first!");
        }
        const authData = { securityCode: { code } };
        const authResponse = await fetch(
            AUTH_ENDPOINT + "verify/trusteddevice/securitycode",
            { headers: this.authStore.getMfaHeaders(), method: "POST", body: JSON.stringify(authData) }
        );
        if (authResponse.status == 204) {
            this._setState(iCloudServiceStatus.Authenticated);
            if (this.options.trustDevice) this.getTrustToken().then(this.getiCloudCookies.bind(this));
            else this.getiCloudCookies();
        } else {
            throw new Error("Invalid status code: " + authResponse.status + " " + await authResponse.text());
        }
    }

    async getTrustToken() {
        if (!this.authStore.validateAuthSecrets()) {
            throw new Error("Cannot get auth token without calling authenticate first!");
        }
        console.debug("[icloud] Trusting device");
        const authResponse = await fetch(
            AUTH_ENDPOINT + "2sv/trust",
            { headers: this.authStore.getMfaHeaders() }
        );
        if (this.authStore.processAccountTokens(this.options.username, authResponse)) {
            this._setState(iCloudServiceStatus.Trusted);
        } else {
            console.error("[icloud] Unable to trust device!");
        }
    }


    async getiCloudCookies() {
        try {
            const data = {
                dsWebAuthToken: this.authStore.sessionToken,
                trustToken: this.authStore.trustToken
            };
            const response = await fetch(SETUP_ENDPOINT, { headers: DEFAULT_HEADERS, method: "POST", body: JSON.stringify(data) });
            if (response.status == 200) {
                if (this.authStore.processCloudSetupResponse(response)) {
                    try {
                        this.accountInfo = await response.json();
                    } catch (e) {
                        console.warn("[icloud] Could not get account info:", e);
                    }

                    try {
                        await this.checkPCS();
                    } catch (e) {
                        console.warn("[icloud] Could not get PCS state:", e);
                    }


                    this._setState(iCloudServiceStatus.Ready);
                    try {
                        require("keytar").setPassword("https://idmsa.apple.com", this.options.username, this.options.password);
                    } catch (e) {
                        console.warn("[icloud] Unable to save account credentials:", e);
                    }
                } else {
                    throw new Error("Unable to process cloud setup response!");
                }
            } else {
                throw new Error("Invalid status code: " + response.status);
            }
        } catch (e) {
            this._setState(iCloudServiceStatus.Error, e);
            throw e;
        }
    }








    async checkPCS() {
        console.log("Test PCS");
        const pcsTest = await fetch("https://setup.icloud.com/setup/ws/1/requestWebAccessState", { headers: this.authStore.getHeaders(), method: "POST" });
        if (pcsTest.status == 200) {
            const j = await pcsTest.json();
            this.pcsEnabled = typeof j.isDeviceConsentedForPCS == "boolean";
            this.pcsAccess = this.pcsEnabled ? j.isDeviceConsentedForPCS : true;
            this.ICDRSDisabled = j.isICDRSDisabled || false;
        }
    }

    async requestServiceAccess(appName: string) {
        await this.checkPCS();
        if (!this.ICDRSDisabled) {
            console.warn("[icloud] requestServiceAccess: ICRS is not disabled.");
            return true;
        }
        if (!this.pcsAccess) {
            const requestPcs = await fetch("https://setup.icloud.com/setup/ws/1/enableDeviceConsentForPCS", { headers: this.authStore.getHeaders(), method: "POST" });
            const requestPcsJson = await requestPcs.json();
            if (!requestPcsJson.isDeviceConsentNotificationSent) {
                throw new Error("Unable to request PCS access!");
            }
        }
        while (!this.pcsAccess) {
            await sleep(5000);
            await this.checkPCS();
        }
        let pcsRequest = await fetch("https://setup.icloud.com/setup/ws/1/requestPCS", { headers: this.authStore.getHeaders(), method: "POST", body: JSON.stringify({ appName, derivedFromUserAction: true }) });
        let pcsJson = await pcsRequest.json();
        while (true) {
            if (pcsJson.status == "success") {
                break;
            } else {
                switch (pcsJson.message) {
                case "Requested the device to upload cookies.":
                case "Cookies not available yet on server.":
                    await sleep(5000);
                    break;
                default:
                    console.error("[icloud] unknown PCS request state", pcsJson);
                }
                pcsRequest = await fetch("https://setup.icloud.com/setup/ws/1/requestPCS", { headers: this.authStore.getHeaders(), method: "POST", body: JSON.stringify({ appName, derivedFromUserAction: false }) });
                pcsJson = await pcsRequest.json();
            }
        }
        this.authStore.addCookies(pcsRequest.headers.raw()["set-cookie"]);

        return true;
    }







    private _serviceCache: {[key: string]: any} = {};
    serviceConstructors: {[key: string]: any} = {
        account: iCloudAccountDetailsService,
        findme: iCloudFindMyService,
        ubiquity: iCloudUbiquityService,
        drivews: iCloudDriveService,
        calendar: iCloudCalendarService,
        photos: iCloudPhotosService
    };

    getService(service: "account"): iCloudAccountDetailsService;
    getService(service: "findme"): iCloudFindMyService;
    getService(service: "ubiquity"): iCloudUbiquityService;
    getService(service: "drivews"): iCloudDriveService
    getService(service: "calendar"): iCloudCalendarService
    getService(service: "photos"): iCloudPhotosService
    getService(service:string) {
        if (!this.serviceConstructors[service]) throw new TypeError(`getService(service: string): 'service' was ${service.toString()}, must be one of ${Object.keys(this.serviceConstructors).join(", ")}`);
        if (service === "photos") {
            this._serviceCache[service] = new this.serviceConstructors[service](this, this.accountInfo.webservices.ckdatabasews.url);
        }
        if (!this._serviceCache[service]) {
            this._serviceCache[service] = new this.serviceConstructors[service](this, this.accountInfo.webservices[service].url);
        }
        return this._serviceCache[service];
    }


    private _storage;
    async getStorageUsage(refresh = false): Promise<iCloudStorageUsage> {
        if (!refresh && this._storage) return this._storage;
        const response = await fetch("https://setup.icloud.com/setup/ws/1/storageUsageInfo", { headers: this.authStore.getHeaders() });
        const json = await response.json();
        this._storage = json;
        return this._storage;
    }
}