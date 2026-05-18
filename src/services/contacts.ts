import fetch from "node-fetch";
import iCloudService from "..";
interface iCloudFieldLabel{
    field: string;
    label: string;
}
interface iCloudContact{
    firstName?: string;
    lastName?: string;
    isGuardianApproved: boolean;
    emailAddresses?: Array<iCloudFieldLabel>;
    contactId: string;
    normalized: string;
    phones?: Array<iCloudFieldLabel>;
    urls?: Array<iCloudFieldLabel>;
    dates?: Array<iCloudFieldLabel>;
    relatedNames?: Array<iCloudFieldLabel>;
    notes?: string;
    birthday?: string;
    etag: string;
    whitelisted: boolean;
    isCompany: boolean;
    profiles?: { field: string; label: string; user: string }[];
    IMs?: { field: { IMService: string; userName: string; }; label: string; }[];
    photo?: { signature: string; url: string; crop: { x: number; y: number; width: number; height: number; } }
    streetAddresses?: {
        field: {
            country: string;
            countryCode: string;
            street?: string;
            city?: string;
            postalCode?: string;
            state?: string;
        };
        label: string;
    }[];
}
interface iCloudContactsStartupResponse {
    syncToken: string;
    prefToken: string;
    contacts: Array<iCloudContact>;
}
interface iCloudContactsContactsResponse {
    contacts: Array<iCloudContact>;
}

export class iCloudContactsService {
    service: iCloudService;
    serviceUri: string;
    constructor(service: iCloudService, serviceUri: string) {
        this.service = service;
        this.serviceUri = serviceUri;
    }
    // fetch contacts
    async contacts() {
        const params = {
            locale: "en_US",
            order: "last,first"
        };
        const url = new URL("/co/startup", this.serviceUri);
        url.search = new URLSearchParams({ ...params, clientVersion: "2.1" }).toString();

        const request = await fetch(url.href, {
            headers: this.service.authStore.getHeaders()
        });
        const json = await request.json() as iCloudContactsStartupResponse;

        const paramsNext = {
            ...params,
            prefToken: json.prefToken,
            syncToken: json.syncToken,
            limit: "0",
            offset: "0"
        };
        const urlNext = new URL("/co/contacts", this.serviceUri);
        urlNext.search = new URLSearchParams({ ...paramsNext, clientVersion: "2.1" }).toString();
        const nextRequest = await fetch(urlNext.href, {
            headers: this.service.authStore.getHeaders()
        });
        const nextJson = await nextRequest.json()as iCloudContactsContactsResponse;

        return nextJson.contacts;
    }
}