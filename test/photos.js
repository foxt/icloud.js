const authenticate = require("./authenticate");
const path = require("path");
const { writeFile } = require("fs/promises");

authenticate.then(async (icloud) => {
    const photosService = icloud.getService("photos");

    // Test regular albums
    console.log("\n=== Testing Regular Albums ===");
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
    const photo = photos.find((p) => p.filename.endsWith(".JPG"));
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

    // Test shared albums
    console.log("\n=== Testing Shared Albums ===");
    const sharedAlbums = await photosService.getSharedAlbums();
    console.log("All your shared album names: ", Array.from(sharedAlbums.keys()).join(", "));

    if (sharedAlbums.size > 0) {
        const firstSharedAlbum = sharedAlbums.values().next().value;
        console.log("\nFirst shared album details:", {
            title: firstSharedAlbum.title,
            guid: firstSharedAlbum.guid,
            ctag: firstSharedAlbum.ctag,
            location: firstSharedAlbum.location,
            ownerId: firstSharedAlbum.ownerId,
            isPublic: firstSharedAlbum.isPublic,
            allowContributions: firstSharedAlbum.allowContributions,
            creationDate: firstSharedAlbum.creationDate
        });

        // Test getting photos
        const photos = await firstSharedAlbum.getPhotos();
        console.log("\nPhotos in shared album:", photos.length);
        
        if (photos.length > 0) {
            const firstPhoto = photos[0];
            console.log("\nFirst photo in shared album:", {
                guid: firstPhoto.guid,
                filename: firstPhoto.filename,
                size: firstPhoto.size,
                created: new Date(firstPhoto.created).toISOString(),
                assetDate: new Date(firstPhoto.assetDate).toISOString(),
                addedDate: new Date(firstPhoto.addedDate).toISOString(),
                dimension: firstPhoto.dimension,
                downloadURL: firstPhoto.downloadURL
            });

            // Try to download the first photo
            const filePath = firstPhoto.filename;
            try {
                const absFilePath = path.resolve(filePath);
                await writeFile(absFilePath, Buffer.from(await firstPhoto.download()));
                console.log(`Successfully saved photo to ${absFilePath}`);
            } catch (err) {
                console.log("Cannot save photo", err);
            }
        }
    } else {
        console.log("No shared albums found");
    };
});