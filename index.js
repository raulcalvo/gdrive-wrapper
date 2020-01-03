'use strict';
const { google } = require('googleapis');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

const TOKEN_PATH = 'token.json';
const fs = require('fs');
const path = require('path');
const mime = require('mime-types')

module.exports = class gdrive {
    constructor() {
        if (fs.existsSync('credentials.json')) {
            this._initialized = false;
            var credentials = fs.readFileSync('credentials.json');
            if (credentials != "") {
                this._initialized = this.authorize(JSON.parse(credentials));
            }
        }
        this._log = console.log;
    }

    setLogFunction(func) {
        this._log = func;
    }

    initDriveInstance(auth) {
        this._drive = google.drive({ version: 'v3', auth });
    }

    authorize(credentials) {
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        this._oAuth = new google.auth.OAuth2(
            client_id, client_secret, redirect_uris[0]);

        // Check if we have previously stored a token.
        if (fs.existsSync(TOKEN_PATH)) {
            const token = fs.readFileSync(TOKEN_PATH);
            this._oAuth.setCredentials(JSON.parse(token));
            this.initDriveInstance(this._oAuth);
            return true;
        }
        return false;
    }

    generateAuthUrl() {
        return this._oAuth.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
    }

    authWithSecret(secret) {
        this._oAuth.getToken(secret, (err, token) => {
            if (err)
                return this._log(err);
            this._oAuth.setCredentials(token);
            this._driveInitialized = true;
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return this._log(err);
                this._log("TOKEN: " + JSON.stringify(token));
            });
        });
    }

    findFile(fileName) {
        if (!this._initialized)
            return Promise.reject("gdrive not initialized.")
        return this._drive.files.list({
            pageSize: 10,
            q: "name = '" + fileName + "' and mimeType = 'application/vnd.google-apps.folder'",
            fields: 'nextPageToken, files(id, name)',
        }).then((res) => {
            const files = res.data.files;
            if (files.length == 1)
                return Promise.resolve(files[0].id);
            else
                return Promise.reject("File not found");
        }).catch((err) => {
            return Promise.reject(err);
        });
    }

    uploadFile(filename, description, folderId) {
        if (!this._initialized)
            return Promise.reject("gdrive not initialized.");
        const name = path.basename(filename);

        var fileMetadata = {
            'parents': [folderId],
            'name': name,
            'description' : description
        };
        var media = {
            mimeType: mime.lookup(filename),
            body: fs.createReadStream(filename)
        };
        return this._drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'description, id, name, mimeType, starred'
        }).then((file) => {
            return Promise.resolve(file.data.id);
        }).catch((err) => {
            return Promise.reject(err);
        });
    }
}
