const authenticate = require("./authenticate");

authenticate.then(async(icloud) => {
    const calendarService = icloud.getService("calendar");
    const calendars = await calendarService.calendars();
    const events = await calendarService.events();
    console.log(`You have ${calendars.length} calendars, and ${events.length} events`);
    const eventDetail = await calendarService.eventDetails(events[0].pGuid, events[0].guid);
    console.log(`Let's get first your event detail: ${eventDetail.title}`);
    console.log(JSON.stringify(eventDetail, null, 4));
});