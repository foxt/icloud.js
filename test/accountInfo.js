const authenticate = require("./authenticate");

authenticate.then(async(icloud) => {
    const storageUsage = await icloud.getStorageUsage();
    for (let mediaType of storageUsage.storageUsageByMedia) {
        console.log(mediaType.displayLabel + ": " + Math.floor(mediaType.usageInBytes / 1000 / 1000).toLocaleString() + "mb usage ");
    }


    const accountService = icloud.getService("account");
    // console.log(accountService)
    const devices = await accountService.getDevices();
    console.log("My devices:");
    for (let device of devices.devices) {
        console.log(device.name + " (" + device.modelDisplayName + ")");
    }
    console.log("My payment cards:" + devices.paymentMethods.map((a) => a.type).join(", "));

    const familyInfo = await accountService.getFamily();
    if (familyInfo.isMemberOfFamily) {
        console.log("Family members: " + familyInfo.familyMembers.map((a) => a.fullName).join(", "));
    } else {
        console.log("Not a member of a family");
    }
});