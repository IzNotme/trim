const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const YTDlpWrap = require('yt-dlp-wrap');
const ffmpeg = require('fluent-ffmpeg');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ytDlpWrap = new YTDlpWrap();

app.use(cors());
app.use(express.json());
app.use(express.static('../public'));
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
fs.ensureDirSync(downloadsDir);

// Configure multer for file handling
const upload = multer({ dest: 'temp/' });

// Clean up old files every 5 minutes
setInterval(async () => {
  try {
    const files = await fs.readdir(downloadsDir);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(downloadsDir, file);
      const stats = await fs.stat(filePath);
      if (now - stats.mtime.getTime() > 30 * 60 * 1000) { // 30 min
        await fs.remove(filePath);
      }
    }
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}, 5 * 60 * 1000);

app.post('/api/get-video', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Get video info
    const info = await ytDlpWrap.execPromise([
      url,
      '--dump-json',
      '--no-warnings'
    ]);

    const videoInfo = JSON.parse(info.toString());
    
    res.json({
      success: true,
      videoId: extractVideoId(url),
      title: videoInfo.title,
      duration: Math.floor(videoInfo.duration),
      thumbnail: videoInfo.thumbnail,
      formats: videoInfo.formats
        .filter(f => f.ext === 'mp4' || f.ext === 'webm')
        .filter(f => f.height && f.height >= 360)
        .map(f => ({
          height: f.height,
          fps: f.fps || 30,
          filesize: f.filesize || 'Unknown'
        }))
        .sort((a, b) => b.height - a.height)
        .slice(0, 5)
    });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(400).json({ error: 'Invalid or unavailable video URL' });
  }
});

app.post('/api/process', async (req, res) => {
  try {
    const { url, startTime, endTime, quality = 'best', format = 'mp4' } = req.body;
    
    if (!url || startTime === undefined || endTime === undefined) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (endTime - startTime > 600) { // 10 min max
      return res.status(400).json({ error: 'Clip duration cannot exceed 10 minutes' });
    }

    if (startTime < 0 || endTime < 0 || startTime >= endTime) {
      return res.status(400).json({ error: 'Invalid time range' });
    }

    const timestamp = Date.now();
    const outputFilename = `clip_${timestamp}.${format}`;
    const outputPath = path.join(downloadsDir, outputFilename);
    const tempPath = path.join(downloadsDir, `temp_${timestamp}.%(ext)s`);

    // Download video
    await ytDlpWrap.execPromise([
      url,
      '-f', quality,
      '-o', tempPath,
      '--no-warnings'
    ]);

    // Find downloaded file
    const tempFiles = await fs.readdir(downloadsDir);
    const tempFile = tempFiles.find(f => f.startsWith(`temp_${timestamp}`));
    
    if (!tempFile) {
      throw new Error('Download failed');
    }

    const inputPath = path.join(downloadsDir, tempFile);

    // Trim with ffmpeg
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(endTime - startTime)
        .outputOptions('-c copy')
        .on('end', async () => {
          try {
            // Cleanup temp file
            await fs.remove(inputPath);
            res.json({ 
              success: true, 
              downloadUrl: `/downloads/${outputFilename}`,
              filename: outputFilename 
            });
          } catch (err) {
            reject(err);
          }
        })
        .on('error', reject)
        .save(outputPath);
    });

  } catch (error) {
    console.error('Process error:', error);
    res.status(500).json({ error: 'Processing failed. Please try again.' });
  }
});

function extractVideoId(url) {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

app.listen(PORT, () => {
  console.log(`🚀 ClipMaster 4K Server running on http://localhost:${PORT}`);
});