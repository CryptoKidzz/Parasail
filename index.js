const chalk = require('chalk').default;
const axios = require('axios');
const fs = require('fs');
const banner = require('./config/banner');

const CHECKIN_URL = 'https://www.parasail.network/api/v1/node/check_in';
const POINT_URL = 'https://www.parasail.network/api/v1/node/node_stats';

// Fungsi membaca semua token dari file
function getBearerTokens() {
    try {
        const tokens = fs.readFileSync('data.txt', 'utf8').trim().split('\n');
        if (tokens.length === 0) throw new Error('Bearer token tidak ditemukan dalam file');
        return tokens;
    } catch (error) {
        console.log(chalk.red('❌ Error membaca bearer token:'), error.message);
        process.exit(1);
    }
}

// Fungsi konversi UNIX timestamp ke format tanggal WIB
function formatTimestamp(timestamp) {
    if (timestamp === 0) return "Belum pernah check-in";
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

// Fungsi untuk mendapatkan informasi node stats (termasuk last_checkin_time dan total points)
async function getNodeStats(headers) {
    try {
        const response = await axios.get(POINT_URL, { headers });
        return response.data.data;
    } catch (error) {
        console.log(chalk.red('⚠️ Error mengambil node stats:'), error.message);
        return null;
    }
}

// Fungsi untuk melakukan check-in
async function checkIn(headers) {
    try {
        await axios.post(CHECKIN_URL, null, { headers });
        return true;
    } catch (error) {
        console.log(chalk.red('⚠️ Error saat check-in:'), error.message);
        return false;
    }
}

// Fungsi utama untuk memproses setiap akun
async function processAccount(token) {
    console.log(chalk.yellow('🔄 Memproses akun dengan token:', token.slice(0, 10) + '...'));

    const headers = { Authorization: `Bearer ${token}` };

    // Dapatkan informasi akun (poin & waktu terakhir check-in)
    const stats = await getNodeStats(headers);
    if (!stats) {
        console.log(chalk.red('❌ Gagal mendapatkan informasi akun!'));
        return;
    }

    let totalPoints = stats.points;
    console.log(chalk.blue(`🏆 Total poin saat ini: ${totalPoints}`));
    console.log(chalk.blue(`🕰️ Waktu terakhir check-in: ${formatTimestamp(stats.last_checkin_time)}`));

    // Periksa apakah sudah waktunya check-in
    const now = Math.floor(Date.now() / 1000);
    const nextCheckInTime = stats.last_checkin_time + (24 * 60 * 60);

    if (now < nextCheckInTime) {
        console.log(chalk.yellow('⏳ Belum waktunya check-in. Menunggu hingga besok...\n'));
        return;
    }

    // Lakukan check-in
    const success = await checkIn(headers);
    if (success) {
        console.log(chalk.green('✅ Berhasil check-in!'));

        // Ambil ulang poin terbaru dari API setelah check-in
        const updatedStats = await getNodeStats(headers);
        if (updatedStats) {
            totalPoints = updatedStats.points; // Perbarui total poin
            console.log(chalk.green(`🎯 Total poin setelah check-in: ${totalPoints}\n`));
        }
    } else {
        console.log(chalk.red('❌ Gagal melakukan check-in.\n'));
    }
}

// Fungsi utama untuk menjalankan auto check-in setiap hari
async function autoCheckIn() {
    while (true) {
        console.log(chalk.cyan('\n🚀 Memulai proses auto check-in...\n'));
        const tokens = getBearerTokens();
        for (const token of tokens) {
            await processAccount(token);
            console.log(chalk.gray('----------------------------'));
            await new Promise(resolve => setTimeout(resolve, 5000)); // Delay antar akun
        }
        console.log(chalk.green('✅ Semua akun telah diproses!'));

        // Tunggu 24 jam sebelum check-in lagi
        console.log(chalk.magenta('\n⏳ Menunggu 24 jam sebelum check-in berikutnya...\n'));
        await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000));
    }
}

// Jalankan program
autoCheckIn();
