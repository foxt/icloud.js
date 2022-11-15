# iCloud.js
*iCloud.js is an independent project, and is not affiliated, endorsed, recommended by or otherwise affiliated with Apple Inc.*

iCloud.js is a library for interacting with Apple's iCloud services for Node.js.

## Thanks

This library would not be possible without the help of:

 - [pyicloud](https://github.com/picklepete/pyicloud)
 - [iCloud Photos Sync](https://github.com/steilerDev/icloud-photos-sync)


## Usage

For more indepth usage details, check the (examples)(https://github.com/foxt/icloud.js/tree/main/test)

### Basic example

```js
const iCloud = require('icloud.js');
const icloud = new iCloud({
    username: "johnny.appleseed@icloud.com",
    password: "hunter2",
    saveCredentials: true,
    trustDevice: true
})
await icloud.authenticate()
console.log(icloud.status)
if (icloud.status === "MfaRequested") {
    await icloud.provideMfaCode("123456")
}
await icloud.awaitReady;
console.log("Hello, " + icloud.accountInfo.dsInfo.fullName)
return icloud
```

## Donations

If this library has helped you, consider donating to the author.

 - [Monzo (U.K. debit cards only)](https://monzo.me/leonesfield)
 - [PayPal](https://paypal.me/foxtdev)
 - [Patreon](https://www.patreon.com/thelmgn)

