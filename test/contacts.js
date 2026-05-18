const authenticate = require("./authenticate");

authenticate.then(async(icloud) => {
    const contactsService = icloud.getService("contacts");
    const contacts = await contactsService.contacts();

    console.log(`You have ${contacts.length} contacts`);
    const firstContact = contacts[0];
    console.log(`Let's get first your contact detail: ${firstContact.lastName}`);
    console.log(JSON.stringify(firstContact, null, 4));
});