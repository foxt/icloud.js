const iCloud = require("../build/index.js").default;
const input = require("input");

module.exports = (async() => {
    const username = await input.text("Username");
    const password = username ? await input.password("Password") : null;
    const icloud = new iCloud({
        username: username ? username : undefined,
        password: password ? password : undefined,
        saveCredentials: true,
        trustDevice: true
    });
    await icloud.authenticate();
    console.log(icloud.status);
    if (icloud.status === "MfaRequested") {
        const mfa = await input.text("MFA Code");
        await icloud.provideMfaCode(mfa);
    }
    await icloud.awaitReady;
    console.log(icloud.status);
    console.log("Hello, " + icloud.accountInfo.dsInfo.fullName);
    return icloud;
})();