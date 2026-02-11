import { google } from 'googleapis';
import { Stream } from 'stream';

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !FOLDER_ID) {
    console.warn("Google Drive credentials not fully configured.");
}

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URL || "http://localhost:8000/auth/google/callback"
);

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({ version: 'v3', auth: oauth2Client });

export async function uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    metadata?: {
        employeeName?: string;
        actionType?: 'clockIn' | 'breakStart' | 'breakEnd' | 'clockOut';
        timestamp?: Date;
    }
): Promise<{ fileId: string; viewUrl: string }> {
    try {
        // Generate custom filename if metadata provided
        let finalFileName = fileName;
        if (metadata?.employeeName && metadata?.actionType && metadata?.timestamp) {
            const date = metadata.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
            const time = metadata.timestamp.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS

            // Map action type to Indonesian
            const actionMap = {
                'clockIn': 'AbsenMasuk',
                'breakStart': 'MulaiIstirahat',
                'breakEnd': 'SelesaiIstirahat',
                'clockOut': 'AbsenPulang'
            };

            const action = actionMap[metadata.actionType];
            const cleanName = metadata.employeeName.replace(/\s+/g, ''); // Remove spaces

            finalFileName = `${cleanName}_${date}_${action}_${time}.jpg`;
        }

        const bufferStream = new Stream.PassThrough();
        bufferStream.end(fileBuffer);

        const response = await drive.files.create({
            requestBody: {
                name: finalFileName,
                parents: [FOLDER_ID!],
                mimeType: mimeType,
            },
            media: {
                mimeType: mimeType,
                body: bufferStream,
            },
            fields: 'id, webViewLink, webContentLink',
        });

        // Make the file readable by anyone with the link
        await drive.permissions.create({
            fileId: response.data.id!,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        return {
            fileId: response.data.id!,
            viewUrl: response.data.webViewLink || ""
        };
    } catch (error) {
        console.error("Google Drive Upload Error:", error);
        throw new Error("Failed to upload file to Google Drive");
    }
}
