const authenticate = require("./authenticate");
const path = require("path");
const { writeFile } = require("fs/promises");

authenticate.then(async(icloud) => {
    const photosService = icloud.getService("photos");
    const albums = await photosService.getAlbums();
    console.log("All your album names: ", Array.from(albums.keys()).join(", "));
    console.log("Get your 'Favorites' album");
    const album = albums.get("Favorites");
    if (!album) {
        return console.log("Cannot find 'Favorites' album");
    }
    console.log(`It contains ${await album.getLength()} photos`);
    console.log("Fetch photos");
    const photos = await album.getPhotos();
    console.log("Get your first photo from album");
    const photo = photos.find((p) => pz.filename.endsWith(".JPG"));
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
    const filePath = photo.filename;
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