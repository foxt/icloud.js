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


export default class iCloudService extends EventEmitter {
    authStore: iCloudAuthenticationStore;
    options: iCloudServiceSetupOptions;

    status: iCloudServiceStatus = iCloudServiceStatus.NotStarted;

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
        this.options.username = username;
        if (!password) {
            try {
                password = await require("keytar").findPassword("https://idmsa.apple.com", username);
            } catch (e) {
                throw new Error("Password was not provided, and unable to use Keytar to find saved credentials" + e.toString());
            }
        }
        // hide password from console.log
        Object.defineProperty(this.options, "password", {
            enumerable: false, // hide it from for..in
            value: password
        });
        if (!username) throw new Error("Username is required");
        if (!password) throw new Error("Password is required");


        if (!fs.existsSync(this.options.dataDirectory)) fs.mkdirSync(this.options.dataDirectory);



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
        if (this.authStore.processAccountTokens(authResponse)) {
            this._setState(iCloudServiceStatus.Trusted);
        } else {
            console.error("[icloud] Unable to trust device!");
        }
    }




    async getiCloudCookies() {
        if (!this.authStore.validateAccountTokens()) {
            throw new Error("Cannot get iCloud cookies because some tokens are missing.");
        }
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

    private _serviceCache: {[key: string]: any} = {};
    serviceConstructors: {[key: string]: any} = {
        account: iCloudAccountDetailsService,
        findme: iCloudFindMyService,
        ubiquity: iCloudUbiquityService,
        drivews: iCloudDriveService,
        calendar: iCloudCalendarService
    };

    getService(service: "account"): iCloudAccountDetailsService;
    getService(service: "findme"): iCloudFindMyService;
    getService(service: "ubiquity"): iCloudUbiquityService;
    getService(service: "drivews"): iCloudDriveService
    getService(service: "calendar"): iCloudCalendarService
    getService(service:string) {
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