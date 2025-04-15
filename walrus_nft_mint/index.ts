import * as path from 'path';
import dotenv from 'dotenv';
import * as fs from 'fs';
import { spawnSync } from 'child_process';
import { log } from 'console';


dotenv.config();

const WALRUS_BIN = process.env.WALLRUS_BIN || 'walrus';
const WALRUS_CONFIG = process.env.WALRUS_CONFIG || 'walrus.json';

const IMAGE_PATH = fs.readFileSync('jeff_rug.png')

async function uploadAndDownloadWalrus() {
    const storeJson = JSON.stringify({
        config: WALRUS_CONFIG,
        command: {
            store: {
                files: [IMAGE_PATH],
                epochs: 2
            }
        }
    })

    const upload = spawnSync(WALRUS_BIN, ['json'], {
        input: storeJson,
        encoding: 'utf-8',
    })

    const uploadResult = JSON.parse(upload.stdout.trim())[0].blobStoreResults;
    let blobId: string;
    let suiObjectId: string | undefined;

    if(uploadResult){
        blobId = uploadResult.newlyCreated.blobObject.blobId;
        suiObjectId = uploadResult.newlyCreated.blobObject.id;
    }else if(uploadResult.alreadyCertified){
        blobId = uploadResult.alreadyCertified.blobId;
    }else{
        console.error("error");
    }

    console.log(`blobId ${blobId}`);

    const readJson = JSON.stringify({
        config: WALRUS_CONFIG,
        command: {
            read: {
                blobId,
            }
        }
    })

    const download = spawnSync(WALRUS_BIN, ['json'], ({
        input: readJson,
        encoding: 'utf-8'
    }))


    const downloadResult = JSON.parse(download.stdout.trim());
    const blobData = Buffer.from(downloadResult.blob, 'base64');
 
    const downloadPath = '/';

    fs.writeFileSync(downloadPath, blobData);
}

uploadAndDownloadWalrus();