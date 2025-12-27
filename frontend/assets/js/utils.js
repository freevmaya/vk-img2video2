async function getImageInfo(imgElement) {
    return new Promise((resolve, reject) => {
        // Проверяем, загружено ли изображение
        if (!imgElement.complete) {
            imgElement.onload = () => processImage();
            imgElement.onerror = reject;
        } else {
            processImage();
        }
        
        function processImage() {
            try {
                // Создаем canvas для анализа
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = imgElement.naturalWidth;
                canvas.height = imgElement.naturalHeight;
                ctx.drawImage(imgElement, 0, 0);
                
                // Получаем данные изображения
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                // Анализ цветов
                let totalR = 0, totalG = 0, totalB = 0;
                let colorMap = {};
                
                // Оптимизация: анализируем каждый 10-й пиксель
                for (let i = 0; i < data.length; i += 40) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    totalR += r;
                    totalG += g;
                    totalB += b;
                    
                    // Создаем ключ цвета для подсчета частоты
                    const colorKey = `${r},${g},${b}`;
                    colorMap[colorKey] = (colorMap[colorKey] || 0) + 1;
                }
                
                const pixelCount = Math.floor(data.length / 40);
                const avgR = Math.round(totalR / pixelCount);
                const avgG = Math.round(totalG / pixelCount);
                const avgB = Math.round(totalB / pixelCount);
                
                // Находим доминирующий цвет
                let dominantColor = '';
                let maxCount = 0;
                
                for (const [color, count] of Object.entries(colorMap)) {
                    if (count > maxCount) {
                        maxCount = count;
                        dominantColor = color;
                    }
                }
                
                // Получаем информацию о формате
                const formatInfo = getFormatInfo(imgElement);
                
                // Результат
                const info = {
                    // Размеры
                    naturalSize: {
                        width: imgElement.naturalWidth,
                        height: imgElement.naturalHeight
                    },
                    displayedSize: {
                        width: imgElement.width,
                        height: imgElement.height,
                        clientWidth: imgElement.clientWidth,
                        clientHeight: imgElement.clientHeight
                    },
                    
                    // Цвета
                    colors: {
                        average: {
                            rgb: `rgb(${avgR}, ${avgG}, ${avgB})`,
                            hex: `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`
                        },
                        dominant: {
                            rgb: `rgb(${dominantColor})`,
                            hex: dominantColor.split(',').map(c => parseInt(c).toString(16).padStart(2, '0')).join('')
                        }
                    },
                    
                    // Формат
                    format: formatInfo,
                    
                    // Дополнительная информация
                    fileSize: getFileSize(imgElement),
                    aspectRatio: (imgElement.naturalWidth / imgElement.naturalHeight).toFixed(2),
                    orientation: imgElement.naturalWidth > imgElement.naturalHeight ? 'landscape' : 
                                imgElement.naturalWidth < imgElement.naturalHeight ? 'portrait' : 'square',
                    
                    // Canvas данные для дальнейшего анализа
                    imageData: imageData
                };
                
                resolve(info);
            } catch (error) {
                reject(error);
            }
        }
    });
}

// Вспомогательные функции
function getFormatInfo(img) {
    const src = img.src;
    
    if (src.startsWith('data:')) {
        return src.split(';')[0].split(':')[1];
    }
    
    if (src.startsWith('blob:')) {
        return 'image/blob';
    }
    
    const extension = src.split('.').pop().toLowerCase().split('?')[0];
    const formats = {
        'jpg': 'JPEG',
        'jpeg': 'JPEG',
        'png': 'PNG',
        'gif': 'GIF',
        'webp': 'WebP',
        'svg': 'SVG',
        'bmp': 'BMP',
        'ico': 'ICO'
    };
    
    return formats[extension] || extension.toUpperCase();
}

function timeDifference(mysqlDate) {
    const now = new Date();
    const past = new Date(mysqlDate);
    const diffMs = now - past; // Разница в миллисекундах

    return Math.floor(Math.abs(diffMs) / 1000); // В сек.
}

function convertMySQLTimeZone(mysqlDateTime, fromTimezone, toTimezone) {
    // MySQL формат: 'YYYY-MM-DD HH:MM:SS'
    const date = new Date(mysqlDateTime.replace(' ', 'T') + 'Z');
    
    // Используем Intl.DateTimeFormat для преобразования
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: toTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    // Форматируем дату
    const parts = formatter.formatToParts(date);
    const result = {};
    
    parts.forEach(part => {
        if (part.type !== 'literal') {
            result[part.type] = part.value;
        }
    });
    
    // Возвращаем в формате MySQL
    return `${result.year}-${result.month}-${result.day} ${result.hour}:${result.minute}:${result.second}`;
}

const toNumber = (value) => {
    if (value == null) return 0;
    
    const num = typeof value === 'number' 
        ? value 
        : parseFloat(String(value).trim().replace(/\s+/g, ''));
    
    return isNaN(num) ? 0 : num;
}

function isNumeric(value) {
    if (value == null) return false;
    const type = typeof value;
    if (type === 'number') {
        return !isNaN(value) && isFinite(value);
    }
    if (type === 'string') {
        const str = value.trim();
        if (str === '') return false;
        const withoutSpaces = str.replace(/\s+/g, '');
        const normalized = withoutSpaces.replace(/,/g, '.');
        const numberRegex = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;
        return numberRegex.test(normalized);
    }
    if (type === 'boolean') return false;
    try {
        const num = Number(value);
        return !isNaN(num) && isFinite(num);
    } catch {
        return false;
    }
}

function strEnum(number, pattern, lang = 'ru') {
    // Парсим паттерн
    const match = pattern.match(/^([^\[]+)\[([^\]]+)\]$/);
    if (!match) {
        // Если паттерн не соответствует формату, возвращаем как есть
        return `${number} ${pattern}`;
    }
    
    const base = match[1];
    const forms = match[2].split(',');
    
    // Для русского языка
    if (lang === 'ru') {
        const num = Math.abs(Number(number));
        
        if (num % 10 === 1 && num % 100 !== 11) {
            return `${number} ${base}${forms[0]}`;
        } else if (num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20)) {
            return `${number} ${base}${forms[1]}`;
        } else {
            return `${number} ${base}${forms[2]}`;
        }
    }
    // Для английского (простая форма - добавляем 's' для множественного числа)
    else if (lang === 'en') {
        const num = Math.abs(Number(number));
        return num === 1 
            ? `${number} ${base}${forms[0]}` 
            : `${number} ${base}${forms[2] || forms[0] + 's'}`;
    }
    // Для других языков можно добавить свои правила
    else {
        return `${number} ${base}`;
    }
}

function closeModal(elem) {
    $(elem).blur().closest('.modal').modal('hide');
}