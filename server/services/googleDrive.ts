import { google } from 'googleapis';
import { Stream } from 'stream';

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !FOLDER_ID) {
    console.warn("⚠️  Google Drive credentials not fully configured. Check your .env file.");
}

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URL || "http://localhost:8000/auth/google/callback"
);

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// Auto-refresh access token before it expires
oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
        // Log jika ada refresh token baru (tidak selalu terjadi)
        console.log('🔄 Google OAuth2: New refresh token received and active.');
    }
    console.log('🔑 Google OAuth2: Access token refreshed automatically.');
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Proactively ensure we have a valid access token before uploading
async function ensureValidToken(): Promise<void> {
    try {
        const tokenInfo = await oauth2Client.getAccessToken();
        if (!tokenInfo.token) {
            throw new Error("Failed to get access token");
        }
    } catch (error: any) {
        console.error("❌ Google OAuth2 token error:", error.message);
        throw new Error(
            "Google Drive authentication failed. The refresh token may be expired. " +
            "Run: node script/get-google-token.js to generate a new token."
        );
    }
}

export async function uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    metadata?: {
        employeeName?: string;
        actionType?: 'clockIn' | 'breakStart' | 'breakEnd' | 'clockOut' | 'lateReason';
        timestamp?: Date;
    }
): Promise<{ fileId: string; viewUrl: string }> {
    // Validate token first — gives a clearer error if it's expired
    await ensureValidToken();

    // Generate custom filename if metadata provided
    let finalFileName = fileName;
    if (metadata?.employeeName && metadata?.actionType && metadata?.timestamp) {
        const date = metadata.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
        const time = metadata.timestamp.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS

        const actionMap = {
            'clockIn': 'AbsenMasuk',
            'breakStart': 'MulaiIstirahat',
            'breakEnd': 'SelesaiIstirahat',
            'clockOut': 'AbsenPulang',
            'lateReason': 'AlasanTelat'
        };

        const action = actionMap[metadata.actionType];
        const cleanName = metadata.employeeName.replace(/\s+/g, '');
        finalFileName = `${cleanName}_${date}_${action}_${time}.jpg`;
    }

    const bufferStream = new Stream.PassThrough();
    bufferStream.end(fileBuffer);

    try {
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

        console.log(`✅ Google Drive: File uploaded successfully — ${finalFileName}`);

        return {
            fileId: response.data.id!,
            viewUrl: response.data.webViewLink || ""
        };
    } catch (error: any) {
        const statusCode = error?.response?.status;
        const errorMsg = error?.response?.data?.error || error?.message || "Unknown error";

        if (statusCode === 401) {
            console.error("❌ Google Drive: 401 Unauthorized — refresh token may be expired.");
            console.error("   Run: node script/get-google-token.js to generate a new token.");
        } else {
            console.error(`❌ Google Drive Upload Error [${statusCode}]:`, errorMsg);
        }

        throw new Error("Failed to upload file to Google Drive");
    }
}
