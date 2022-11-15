const authenticate = require("./authenticate");

authenticate.then(async(icloud) => {
    const driveService = icloud.getService("ubiquity");
    console.log(await driveService.getNode());
});