import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import fetch from "node-fetch";
import iCloudService from "..";
dayjs.extend(utc);
dayjs.extend(timezone);

interface iCloudCalendarAlarm {
  messageType: string;
  pGuid: string;
  guid: string;
  isLocationBased: boolean;
  measurement: {
    hours: number;
    seconds: number;
    weeks: number;
    minutes: number;
    days: number;
    before: boolean;
  }
}

interface iCloudCalendarEvent {
  tz: string;
  icon: number;
  recurrenceException: boolean;
  title: string;
  tzname: string;
  duration: number;
  allDay: boolean;
  startDateTZOffset: string;
  pGuid: string;
  hasAttachments: boolean;
  birthdayIsYearlessBday: boolean;
  alarms: string[];
  lastModifiedDate: number[];
  readOnly: boolean;
  localEndDate: number[];
  recurrence: string;
  localStartDate: number[];
  createdDate: number[];
  extendedDetailsAreIncluded: boolean;
  guid: string;
  etag: string;
  startDate: number[];
  endDate: number[];
  birthdayShowAsCompany: boolean;
  recurrenceMaster: boolean;
  attachments: any[];
  shouldShowJunkUIWhenAppropriate: boolean;
  url: string;
}

interface iCloudCalendarRecurrence {
  guid: string;
  pGuid: string;
  freq: string;
  interval: number;
  recurrenceMasterStartDate: any[];
  weekStart: string;
  frequencyDays: string;
  weekDays: any[];
}

interface iCloudCalendarInvitee {
  commonName: string;
  isMe: boolean;
  isOrganizer: boolean;
  inviteeStatus: string;
  pGuid: string;
  guid: string;
  isSenderMe: boolean;
  email: string;
  cutype: string;
}

interface iCloudCalendarCollection {
  title: string;
  guid: string;
  ctag: string;
  order: number;
  color: string;
  symbolicColor: string;
  enabled: boolean;
  createdDate: number[];
  isFamily: boolean;
  lastModifiedDate: number[];
  shareTitle: string;
  prePublishedUrl: string;
  supportedType: string;
  etag: string;
  isDefault: boolean;
  objectType: string;
  readOnly: boolean;
  isPublished: boolean;
  isPrivatelyShared: boolean;
  extendedDetailsAreIncluded: boolean;
  shouldShowJunkUIWhenAppropriate: boolean;
  publishedUrl: string;
}

interface iCloudCalendarEventDetailResponse {
  Alarm: Array<iCloudCalendarAlarm>;
  Event: Array<iCloudCalendarEvent>;
  Invitee: Array<iCloudCalendarInvitee>;
  Recurrence: Array<iCloudCalendarRecurrence>;
}

interface iCloudCalendarStartupResponse {
  Alarm: Array<iCloudCalendarAlarm>,
  Event: Array<iCloudCalendarEvent>,
  Collection: Array<iCloudCalendarCollection>
}

interface iCloudCalendarEventsResponse {
  Alarm: Array<iCloudCalendarAlarm>;
  Event: Array<iCloudCalendarEvent>;
  Recurrence: Array<iCloudCalendarRecurrence>;
}

export class iCloudCalendarService {
    service: iCloudService;
    serviceUri: string;
    dsid: string;
    dateFormat = "YYYY-MM-DD";
    calendarServiceUri: string;
    tz = dayjs.tz.guess() || "UTC";
    constructor(service: iCloudService, serviceUri: string) {
        this.service = service;
        this.serviceUri = serviceUri;
        this.dsid = this.service.accountInfo.dsInfo.dsid;
        this.calendarServiceUri = `${service.accountInfo.webservices.calendar.url}/ca`;
    }
    private async fetchEndpoint<T = any>(endpointUrl: string, params: Record<string, string>): Promise<T> {
        const url = new URL(`${this.calendarServiceUri}${endpointUrl}`);
        url.search = new URLSearchParams({ ...params, clientVersion: "5.1" }).toString();

        const response = await fetch(url, {
            headers: {
                ...this.service.authStore.getHeaders(),
                Referer: "https://www.icloud.com/"
            }
        });

        return await response.json() as T;
    }
    async eventDetails(calendarGuid: string, eventGuid: string) {
        const response = await this.fetchEndpoint<iCloudCalendarEventDetailResponse>(`/eventdetail/${calendarGuid}/${eventGuid}`, {
            lang: "en-us",
            usertz: this.tz,
            dsid: this.dsid
        });

        return response.Event[0];
    }
    async events(from?: Date, to?: Date) {
        const response = await this.fetchEndpoint<iCloudCalendarEventsResponse>("/events", {
            startDate: dayjs(from ?? dayjs().startOf("month")).format(this.dateFormat),
            endDate: dayjs(to ?? dayjs().endOf("month")).format(this.dateFormat),
            dsid: this.dsid,
            lang: "en-us",
            usertz: this.tz
        });

        return response.Event || [];
    }
    async calendars() {
        const response = await this.fetchEndpoint<iCloudCalendarStartupResponse>("/startup", {
            startDate: dayjs(dayjs().startOf("month")).format(this.dateFormat),
            endDate: dayjs(dayjs().endOf("month")).format(this.dateFormat),
            dsid: this.dsid,
            lang: "en-us",
            usertz: this.tz
        });

        return response.Collection || [];
    }
}