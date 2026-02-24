/**
 * Script untuk generate Google OAuth2 Refresh Token baru.
 * 
 * Cara pakai:
 *   node script/get-google-token.cjs
 * 
 * Kemudian buka URL yang muncul di browser, login dengan akun Google
 * yang memiliki akses ke Google Drive folder, lalu copy refresh_token
 * yang muncul ke file .env (GOOGLE_DRIVE_REFRESH_TOKEN=...)
 */

const http = require('http');
const { google } = require('googleapis');

// Load .env manually
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) process.env[match[1].trim()] = match[2].trim();
    });
}

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3333/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ GOOGLE_DRIVE_CLIENT_ID dan GOOGLE_DRIVE_CLIENT_SECRET harus diisi di .env');
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = ['https://www.googleapis.com/auth/drive'];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // PENTING: memaksa Google issue refresh_token baru
});

console.log('\n🌐 Buka URL ini di browser:\n');
console.log(authUrl);
console.log('\n⏳ Menunggu callback dari Google...\n');

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:3333`);
    const code = url.searchParams.get('code');

    if (!code) {
        res.end('<h2>❌ Tidak ada code. Coba lagi.</h2>');
        return;
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);

        console.log('\n✅ Berhasil! Refresh Token kamu:\n');
        console.log('GOOGLE_DRIVE_REFRESH_TOKEN=' + tokens.refresh_token);
        console.log('\n📋 Copy baris di atas ke file .env dan ke environment variables server (VPS).\n');

        res.end(`
      <html><body style="font-family:sans-serif;padding:40px">
        <h2>✅ Refresh Token Berhasil Dibuat!</h2>
        <p>Salin nilai ini ke <code>.env</code>:</p>
        <pre style="background:#f0f0f0;padding:15px;border-radius:8px;word-break:break-all">GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}</pre>
        <p>Jangan lupa update juga di VPS / environment server kamu.</p>
        <p>Sekarang bisa tutup tab ini.</p>
      </body></html>
    `);

        setTimeout(() => {
            server.close();
            console.log('👋 Server lokal ditutup. Selesai!');
        }, 2000);
    } catch (err) {
        console.error('❌ Gagal tukar code:', err.message);
        res.end('<h2>❌ Error: ' + err.message + '</h2>');
    }
});

server.listen(3333, () => {
    console.log('🚀 Server callback berjalan di http://localhost:3333');
});
