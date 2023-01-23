const authenticate = require("./authenticate");
const input = require("input");

authenticate.then(async(icloud) => {
    await icloud.requestServiceAccess("iclouddrive");
    const driveService = icloud.getService("drivews");
    let root = await driveService.getNode();
    while (true) {
        let response = await input.select("Select an item", [
            {
                name: "⬆️ Up a directory",
                value: root.parentId
            },
            ...root.items.map((a) => {
                if (a.type === "FILE") {
                    return { name: "📄 " + a.name + "." + a.extension, value: a };
                } else if (a.type === "FOLDER") {
                    return { name: "📁 " + a.name, value: a };
                } else {
                    return { name: "🖌️ " + a.name, value: a };
                }
            })
        ]);
        if (response.type === "FILE") {
            console.log("Downloading file...");
            let file = await driveService.downloadFile(response);
            file.pipe(require("fs").createWriteStream(response.name + "." + response.extension));
            await new Promise((resolve) => {
                file.on("end", resolve);
            });
            console.log("Downloaded file!");
        } else {
            root = await driveService.getNode(response);
        }
    }
});