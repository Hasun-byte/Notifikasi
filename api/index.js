const express = require('express');
const bodyParser = require('body-parser');
const { Client, MessageMedia, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');

const app = express();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

let qrCodeData = null;
let isClientReady = false;

// Setup MongoDB for session storage
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://acunxboys612:WwIeGSoIEFigILHi@cluster0.5ct8z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const store = new MongoStore({ mongoose });

const client = new Client({
    authStrategy: new RemoteAuth({ store }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-gpu', '--disable-setuid-sandbox'],
    },
});

// QR Code generation
client.on('qr', (qr) => {
    console.log('QR Code generated:', qr);
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('Error generating QR Code URL:', err);
        } else {
            qrCodeData = url;
        }
    });
});

// Client events
client.on('ready', () => {
    console.log('Client is ready!');
    isClientReady = true;
});

client.on('disconnected', () => {
    console.log('Client disconnected');
    isClientReady = false;
});

// Initialize WhatsApp client
client.initialize();

app.post('/send-message', async (req, res) => {
    let { nohp, pesan, foto } = req.body;

    if (!nohp || !pesan) {
        return res.status(400).json({ status: 'error', pesan: 'No HP dan pesan harus disertakan.' });
    }

    try {
        if (nohp.startsWith('0')) {
            nohp = '62' + nohp.slice(1);
        } else if (!nohp.startsWith('62')) {
            nohp = '62' + nohp;
        }

        nohp = nohp + '@c.us';

        const isRegistered = await client.isRegisteredUser(nohp);

        if (isRegistered) {
            await client.sendMessage(nohp, pesan);

            if (foto) {
                const media = new MessageMedia('image/jpeg', foto.split(';base64,').pop());
                await client.sendMessage(nohp, media, { caption: pesan });
            }

            res.json({ status: 'Berhasil Kirim', pesan });
        } else {
            res.status(404).json({ status: 'Gagal', pesan: 'Nomor Tidak Terdaftar di WhatsApp' });
        }
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ status: 'error', pesan: 'Terjadi kesalahan server' });
    }
});

app.get('/', (req, res) => {
    res.send('Server is running on Vercel!');
});

app.get('/get-qr', (req, res) => {
    if (qrCodeData) {
        res.json({ success: true, qrCode: qrCodeData });
    } else {
        res.json({ success: false, message: 'QrCode Belum Siap' });
    }
});

app.get('/client-status', (req, res) => {
    if (isClientReady) {
        res.json({ status: 'ready', success: true, message: 'Client is ready' });
    } else if (qrCodeData === null) {
        res.json({ status: 'waitingQR', success: false, message: 'Waiting for QR Code' });
    } else {
        res.json({ status: 'qrAvailable', success: false, message: 'QR Code is available' });
    }
});

// Export the app for Vercel
module.exports = app;
