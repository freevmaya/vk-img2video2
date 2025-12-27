const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const axios = require('axios');
const path = require('path');

// Устанавливаем путь к ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Генерация превью с автоматическим определением размеров
 * @param {string} videoPath - путь к видео
 * @param {string} outputPath - путь для сохранения превью
 * @param {number} timeInSeconds - момент для скриншота
 * @param {number} scalePercent - процент от исходного размера (по умолч. 50%)
 * @param {number} maxWidth - максимальная ширина (опционально)
 * @param {number} maxHeight - максимальная высота (опционально)
 */
exports.generateThumbnail = async function(videoPath, outputPath, timeInSeconds = 10, scalePercent = 50, maxWidth = null, maxHeight = null) {
  try {
    // 1. Получаем информацию о видео
    const metadata = await getVideoMetadata(videoPath);
    const { width, height } = metadata.streams.find(s => s.codec_type === 'video');
    
    console.log(`Исходное разрешение: ${width}x${height}`);
    
    // 2. Рассчитываем размеры превью
    let previewWidth = Math.round(width * (scalePercent / 100));
    let previewHeight = Math.round(height * (scalePercent / 100));
    
    // 3. Применяем ограничения по максимальным размерам
    if (maxWidth && previewWidth > maxWidth) {
      const scaleRatio = maxWidth / previewWidth;
      previewWidth = maxWidth;
      previewHeight = Math.round(previewHeight * scaleRatio);
    }
    
    if (maxHeight && previewHeight > maxHeight) {
      const scaleRatio = maxHeight / previewHeight;
      previewHeight = maxHeight;
      previewWidth = Math.round(previewWidth * scaleRatio);
    }
    
    // 4. Убедимся, что размеры четные (требование ffmpeg)
    previewWidth = previewWidth % 2 === 0 ? previewWidth : previewWidth - 1;
    previewHeight = previewHeight % 2 === 0 ? previewHeight : previewHeight - 1;
    
    console.log(`Превью будет: ${previewWidth}x${previewHeight}`);
    
    // 5. Генерируем превью
    return new Promise((resolve, reject) => {
      
      let fileName = path.basename(videoPath, path.extname(videoPath)) + '.jpg';
      let outputFilePath = outputPath + fileName;

      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timeInSeconds],
          filename: fileName,
          folder: outputPath,
          size: `${previewWidth}x${previewHeight}`
        })
        .on('end', () => {
          console.log('Превью успешно создано');
          resolve({
            original: { width, height },
            thumbnail: { width: previewWidth, height: previewHeight },
            filePath: outputFilePath
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
    
  } catch (error) {
    throw new Error(`Ошибка при генерации превью: ${error.message}`);
  }
}

/**
 * Получение метаданных видео
 */
function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
}

/*
async function main() {
  try {
    const result = await generateThumbnail(
      'video.mp4',
      './thumbnails/preview.jpg',
      5,     // 5 секунда
      20,    // 20% от исходного размера
      640,   // макс. ширина 640px
      480    // макс. высота 480px
    );
    
    console.log('Результат:', result);
  } catch (error) {
    console.error('Ошибка:', error);
  }
}*/



exports.downloadWithAxios = async function(url, outputPath, filename = null) {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream', // Важно для больших файлов
            headers: {
                'User-Agent': 'Mozilla/5.0 (Node.js Downloader)'
            },
            timeout: 30000
        });
        
        if (!filename) {
            // Определяем имя файла
            filename = path.basename(url);
            const contentDisposition = response.headers['content-disposition'];
            
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?(.+?)"?$/);
                if (match) filename = match[1];
            }
        }
        
        let ext = null;
        // Если имя файла не содержит расширения, добавляем из Content-Type
        if (!path.extname(filename) && response.headers['content-type']) {
            ext = getExtensionFromMime(response.headers['content-type']);
            if (ext) filename += `.${ext}`;
        }
        
        const filePath = outputPath + filename;
        
        // Создаем поток для записи
        const writer = fs.createWriteStream(filePath);
        
        // Записываем файл
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                resolve({
                    path: filePath,
                    filename: filename,
                    size: fs.statSync(filePath).size,
                    contentType: response.headers['content-type'],
                    status: response.status
                });
            });
            
            writer.on('error', (err) => {
                fs.unlink(filePath, () => {});
                reject(err);
            });
        });
        
    } catch (error) {
        console.error(`Ошибка загрузки: ${error.message}`);
    }
}

exports.one = function(obj, prop) {
    if (has(obj, prop)) {
        let value = obj[prop];
        if (typeof value === 'string') 
            return value.split(',')[0];
        else return value[0];
    }
    return false;
}

function has(obj, prop) {
    if (!obj || obj[prop] == null) return false;
    
    const value = obj[prop];
    
    // Проверка разных типов данных
    switch (true) {
        case typeof value === 'string':
            return value.trim() !== '';
        case Array.isArray(value):
            return value.length > 0;
        case typeof value === 'object':
            return Object.keys(value).length > 0;
        case typeof value === 'number':
            return !isNaN(value); // или value !== 0 в зависимости от требований
        default:
            return true; // boolean, function и т.д.
    }
}

function getExtensionFromMime(mimeType) {
    const mimeToExt = {
        'video/mp4': 'mp4',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'application/pdf': 'pdf',
        'application/zip': 'zip',
        'text/plain': 'txt',
        'text/html': 'html',
        'application/json': 'json'
    };

    if (!mimeToExt[mimeType])
        console.log('Not found mime type: ' + mimeType);
    
    return mimeToExt[mimeType] || null;
}