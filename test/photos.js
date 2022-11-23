const authenticate = require("./authenticate");
const path = require("path");
const { writeFile } = require("fs/promises");

authenticate.then(async(icloud) => {
    const photosService = icloud.getService("photos");
    const albums = await photosService.albums;
    console.log("All your album names: ", Object.keys(albums).join(", "));
    console.log("Get your 'Favorites' album");
    const album = albums.Favorites;
    if (!album) {
        return console.log("Cannot find 'Favorites' album");
    }
    console.log(`It contains ${await album.length} photos`);
    console.log("Fetch photos");
    const photos = await album.photos;
    console.log("Get your first photo from album");
    const photo = photos[0];
    console.log({
        id: photo.id,
        filename: photo.filename,
        size: photo.size,
        created: photo.created,
        assetDate: photo.assetDate,
        addedDate: photo.addedDate,
        dimension: photo.dimension,
        versions: photo.versions
    });
    const filePath = "./image.jpg";
    try {
        const absFilePath = path.resolve(filePath);
        await writeFile(absFilePath, Buffer.from(await photo.download()));
        console.log(`Successfully saved photo to ${absFilePath}`);
    } catch (err) {
        console.log("Cannot save photo", err);
    }
    // WARNING: uncomment lines below for delete photo
    // if (await photo.delete()) {
    //     console.log("You successfully delete photo");
    // } else {
    //     console.log("Cannot delete photo");
    // }
});