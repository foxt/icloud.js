const iCloud = require("../build/index.js").default;
const input = require("input");

async function authenticate(options = {}) {
    const username = process.env.VSCODE_INSPECTOR_OPTIONS ? "" : await input.text("Username");
    const password = username ? await input.password("Password") : null;
    const defaultOptions = {
        username: username ? username : undefined,
        password: password ? password : undefined,
        saveCredentials: true,
        trustDevice: true,
        authMethod: "srp"
    };
    const icloud = new iCloud({ ...defaultOptions, ...options });
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
}

module.exports = authenticate;

if (require.main === module) {
    authenticate()
        .then((icloud) => {
            console.log("Entering REPL, icloud is available as 'icloud'");
            require("node:repl").start().context.icloud = icloud;
        });
}
