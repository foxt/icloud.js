const authenticate = require("./authenticate");

authenticate({ pause2FA: true }).then(async(icloud) => {
    const findMyService = icloud.getService("findme");
    await findMyService.refresh();
    for (let device of findMyService.devices.values()) {
        console.log(device.deviceInfo.name + "\t" + Math.floor(device.deviceInfo.batteryLevel * 100) + "% " + device.deviceInfo.batteryStatus);
    }
});