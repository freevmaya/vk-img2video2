// Файл: vk-img2video/backend/websocket-server.js

const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const url = require('url');
const mysql = require('mysql2/promise');
const axios = require('axios');
const fs = require('fs');
const { VK } = require('vk-io');

const config = require('../config.json');

const process = require('process');

async function downloadWithAxios(url, outputPath, filename = null) {
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
        throw new Error(`Ошибка загрузки: ${error.message}`);
    }
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

function one(obj, prop) {
    if (has(obj, prop)) {
        let value = obj[prop];
        if (typeof value === 'string') 
            return value.split(',')[0];
        else return value[0];
    }
    return false;
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

class WebSocketServer {
    constructor() {
        this.clients = new Map();
        this.subscriptions = new Map();
        this.config = config; // Сохраняем всю конфигурацию
        this.db = null; // Инициализируем как null
        this.isDbConnected = false;
        this.reconnectionAttempts = 0;
        this.maxReconnectionAttempts = 10;
        this.downloadPromises = {};

        this.vk = new VK({
            appId: this.config.vk.app_id,
            token: this.config.vk.VK_SERVICE_TOKEN
        });
        
        this.init();
        if (process.send) {
          process.send('ready');
        }
        
        // Настраиваем graceful shutdown
        this.setupGracefulShutdown();
    }

    async init() {
        // Создаем сервер для WebSocket
        this.RESULT_PATH = this.config.paths.results || 'frontend/downloads/results/';

        if (this.config.websocket.ssl.enabled) {

            this.port = this.config.websocket.ssl.port;
            this.protocol = this.config.websocket.ssl.protocol;
            this.host = this.config.websocket.ssl.host;

            this.server = https.createServer({
                key: fs.readFileSync(this.config.websocket.ssl.key),
                cert: fs.readFileSync(this.config.websocket.ssl.cert)
            });
            this.wss = new WebSocket.Server({ server: this.server });
            this.protocol = 'wss';
        } else {
            this.host = this.config.websocket.host;
            this.server = http.createServer();
            this.wss = new WebSocket.Server({ server: this.server });
            this.port = process.env.WS_PORT || config.websocket.port;
            this.protocol = 'ws';
        }

        await this.connectToDatabase();
        
        this.setupEventHandlers();
        this.start();
    }  

    async connectToDatabase() {
        try {
            this.db = await mysql.createConnection({
                host: this.config.database.host,
                user: this.config.database.user,
                password: this.config.database.password,
                database: this.config.database.database,
                charset: this.config.database.charset,
                // Настройки для поддержания соединения
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                // Включаем keep-alive
                enableKeepAlive: true,
                keepAliveInitialDelay: 0
            });

            // Добавляем обработчики событий соединения
            this.db.on('error', (err) => {
                console.error('Database connection error:', err);
                this.isDbConnected = false;
                
                // Если это не критическая ошибка (например, таймаут), пытаемся переподключиться
                if (err.code === 'PROTOCOL_CONNECTION_LOST' || 
                    err.code === 'ECONNRESET' ||
                    err.code === 'ETIMEDOUT') {
                    this.reconnectToDatabase();
                }
            });

            this.db.on('end', () => {
                console.log('Database connection ended');
                this.isDbConnected = false;
                this.reconnectToDatabase();
            });

            this.isDbConnected = true;
            this.reconnectionAttempts = 0;
            console.log('Database connected successfully');
            
        } catch (error) {
            console.error('Failed to connect to database:', error);
            this.isDbConnected = false;
            // Ждем и пытаемся переподключиться
            setTimeout(() => this.reconnectToDatabase(), 5000);
        }
    }

    async reconnectToDatabase() {
        if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
            console.error('Max reconnection attempts reached. Stopping reconnection.');
            return;
        }

        this.reconnectionAttempts++;
        console.log(`Attempting to reconnect to database (attempt ${this.reconnectionAttempts})...`);
        
        try {
            // Закрываем старое соединение если оно есть
            if (this.db) {
                try {
                    await this.db.end();
                } catch (e) {
                    // Игнорируем ошибки при закрытии
                }
            }
            
            await this.connectToDatabase();
        } catch (error) {
            console.error(`Reconnection attempt ${this.reconnectionAttempts} failed:`, error);
            
            // Экспоненциальная задержка между попытками
            const delay = Math.min(30000, 5000 * Math.pow(2, this.reconnectionAttempts - 1));
            setTimeout(() => this.reconnectToDatabase(), delay);
        }
    }

    connecClient(_ws, req) {

        const parameters = url.parse(req.url, true).query;

        const userId = one(parameters, 'userId');
        const _timeZone = one(parameters, 'timeZone');
        var token = one(parameters, 'token');
        
        // Аутентификация
        if (!userId || !token) {
            _ws.close(1008, 'Authentication required');
            console.log(`Authentication required (${req.url})`);
            return;
        }
        
        // Проверяем токен (упрощенно)
        if (!this.verifyToken(userId, token)) {
            _ws.close(1008, 'Invalid token');
            console.log(`Invalid token (${req.url})`);
            return;
        }

        console.log(`New WebSocket connection: ${userId}, ${token}`);  
        
        // Сохраняем соединение
        this.clients.set(userId, { 
            ws : _ws, 
            timeZone: _timeZone 
        });

        let total = Array.from(this.clients.keys());
        console.log(`User ${userId} connected. Total clients: ${total}`);
        
        // Настройка обработчиков сообщений
        _ws.on('message', (data) => this.handleMessage(_ws, userId, data));
        _ws.on('close', () => this.handleDisconnect(userId));
        _ws.on('error', (error) => this.handleError(userId, error));

        this.sendNotificationVK(userId, "Проба!");

        this.getAvgTaskTime()
            .then((avgDelta)=>{                
                // Отправляем подтверждение подключения
                _ws.send(JSON.stringify({
                    type: 'connection_established',
                    message: 'WebSocket connected successfully',
                    timestamp: Date.now(),
                    avgTaskSpeed: 100/avgDelta
                }));
            })
            .catch((error)=>{
                _ws.send(JSON.stringify({
                    type: 'connection_established',
                    message: 'WebSocket connected successfully',
                    timestamp: Date.now()
                }));
            });


        this.executeQuery("SELECT * FROM task WHERE user_id = ? AND state = 'active'", [userId])
            .then((rows)=>{
                _ws.send(JSON.stringify({
                    type: 'active_tasks',
                    tasks: rows
                }))
            });
    }

    sendNotificationVK(userId, message) {
        this.executeQuery("SELECT * FROM users WHERE id = ?", [userId])
            .then((rows)=>{
                if (rows.length > 0) {
                    this.sendNotification(rows[0].vk_user_id, message);
                }
            })
    }

    async function sendNotification(vk_user_id, message) {
        try {
            await vk.api.notifications.sendMessage({
              user_id: vk_user_id,
              message: message,
              // Другие параметры, если есть
            });
            console.log(`Уведомление отправлено пользователю ${vk_user_id}`);
            } catch (error) {
            console.error(`Ошибка отправки уведомления ${vk_user_id}:`, error);
        }
    }

    setupEventHandlers() {
        this.wss.on('connection', (_ws, req) => {
            this.connecClient(_ws, req);
        });
    }

    ws(userId) {
        return this.clients.get(userId).ws;
    }

    //Получаем среднее продолжительность создания видео
    async getAvgTaskTime() {
        return new Promise((resolve, reject)=>{
            try {
                this.executeQuery(
                    'SELECT AVG(delta) AS avgDelta FROM (SELECT task_id, count(id), MAX(`completed_at`) - MIN(`created_at`) AS delta FROM `kling_tasks` GROUP BY task_id) t WHERE delta > 0 AND delta < 1000'
                )
                .then((rows)=>{
                    if (rows.length > 0)
                        resolve(rows[0].avgDelta);
                })
            } catch (error) {
                console.error(error);
                reject(reject);
            }
        });
    }

    async executeQuery(sql, params = []) {
        if (!this.isDbConnected || !this.db) {
            throw new Error('Database not connected');
        }

        try {
            const [rows] = await this.db.execute(sql, params);
            return rows;
        } catch (error) {
            // Проверяем, не связано ли с разрывом соединения
            if (error.code === 'PROTOCOL_CONNECTION_LOST' || 
                error.code === 'ECONNRESET' ||
                error.code === 'ETIMEDOUT') {
                this.isDbConnected = false;
                this.reconnectToDatabase();
            }
            throw error;
        }
    }

    async verifyToken(userId, token) {
        try {
            const rows = await this.executeQuery(
                'SELECT id, access_token FROM users WHERE id = ?',
                [userId]
            );
            
            if (rows.length > 0) {
                return rows[0].access_token == token;
            }
            return false;
        } catch (error) {
            console.error('Error verifying token:', error);
            return false;
        }
    }

    async handleMessage(ws, userId, data) {
        try {
            const message = JSON.parse(data);
            console.log(`Message from user ${userId}:`, message);
            
            switch (message.type) {
                case 'test':
                    await this.handleTest(userId, message);
                    break;

                case 'auth':
                    await this.handleAuth(userId, message);
                    break;
                    
                case 'check_auth':
                    await this.checkAuth(userId, message);
                    break;
                    
                case 'subscribe':
                    await this.handleSubscribe(userId, message.task_id);
                    break;
                    
                case 'unsubscribe':
                    await this.handleUnsubscribe(userId, message.task_id);
                    break;
                    
                case 'get_balance':
                    await this.sendBalance(userId);
                    break;
                    
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    break;
                    
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    }

    async checkAuth(userId, message) {
        const ws = this.ws(userId);

        const [rows] = await this.executeQuery(
                'SELECT id, balance FROM users WHERE id = ?',
                [userId]
            );
        
        console.log(userId);
        if ((rows.length > 0) && (rows[0].access_token == message.auth_token)) {
            ws.send(JSON.stringify({
                type: 'check_auth',
                message: {
                    user: rows[0]
                }
            }));
        }
        ws.send(JSON.stringify({
            type: 'check_auth',
            message: false
        }));
    }

    async handleTest(userId, message) {
        const ws = this.ws(userId);
        ws.send(JSON.stringify({
            type: 'test_success',
            message: 'Test success!'
        }));
    }

    async handleAuth(userId, message) {
        const ws = this.ws(userId);
        if (!ws) return;
        
        // Проверяем пользователя в базе данных
        try {
            const [rows] = await this.executeQuery(
                'SELECT id, balance FROM users WHERE id = ?',
                [userId]
            );
            
            if (rows.length > 0) {
                ws.send(JSON.stringify({
                    type: 'auth_success',
                    user_id: userId,
                    balance: rows[0].balance
                }));
            }
        } catch (error) {
            console.error('Auth error:', error);
        }
    }

    async handleSubscribe(userId, taskId) {
        if (!this.subscriptions.has(taskId)) {
            this.subscriptions.set(taskId, new Set());
        }
        this.subscriptions.get(taskId).add(userId);
        
        console.log(`User ${userId} subscribed to task ${taskId}`);
        
        // Немедленно отправляем текущий статус задачи
        await this.sendTaskUpdate(taskId);
    }

    async handleUnsubscribe(userId, taskId) {
        if (this.subscriptions.has(taskId)) {
            this.subscriptions.get(taskId).delete(userId);
            
            if (this.subscriptions.get(taskId).size === 0) {
                this.subscriptions.delete(taskId);
            }
            
            console.log(`User ${userId} unsubscribed from task ${taskId}`);
        }
    }

    async sendTaskUpdate(taskId) {
        try {
            // Получаем информацию о задаче из базы данных
            const [rows] = await this.executeQuery(
                `SELECT * 
                 FROM task
                 WHERE id = ?`,
                [taskId]
            );
            
            if (rows.length === 0) return;
            
            const task = rows[0];
            
            // Отправляем обновление всем подписчикам
            if (this.subscriptions.has(taskId)) {
                const subscribers = this.subscriptions.get(taskId);
                
                const message = JSON.stringify({
                    type: 'task_update',
                    task_id: taskId,
                    state: task.state,
                    timestamp: Date.now()
                });
                
                subscribers.forEach(userId => {
                    const ws = this.ws(userId);
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(message);
                    }
                });
            }
        } catch (error) {
            console.error('Error sending task update:', error);
        }
    }

    async sendBalance(userId) {
        const ws = this.ws(userId.toString());
        if (ws) {
        
            try {
                const [rows] = await this.executeQuery(
                    'SELECT balance FROM users WHERE id = ?',
                    [userId]
                );

                return ws.send(JSON.stringify({
                    type: 'balance_update',
                    balance: rows.balance ?? rows[0].balance,
                    timestamp: Date.now()
                }));
            } catch (error) {
                console.error('Error sending balance:', error);
            }
        }
    }

    handleDisconnect(userId) {
        console.log(`User ${userId} disconnected`);
        this.clients.delete(userId);
        
        // Удаляем пользователя из всех подписок
        this.subscriptions.forEach((subscribers, taskId) => {
            subscribers.delete(userId);
            if (subscribers.size === 0) {
                this.subscriptions.delete(taskId);
            }
        });
    }

    handleError(userId, error) {
        console.error(`WebSocket error for user ${userId}:`, error);
    }

    // Метод для отправки системных уведомлений
    sendNotification(userId, message, type = 'info') {
        const ws = this.ws(userId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'system_notification',
                message: message,
                notification_type: type,
                timestamp: Date.now()
            }));
        }
    }

    // Метод для обновления статуса задачи (вызывается из cron или webhook)
    async updateTaskStatus(taskId, status, progress, videoUrl = null) {
        try {
            // Обновляем в базе данных
            if (videoUrl) {
                await this.executeQuery(
                    `UPDATE task 
                     SET status = ?, progress = ?, generated_video_url = ?, updated_at = NOW() 
                     WHERE id = ?`,
                    [status, progress, videoUrl, taskId]
                );
            } else {
                await this.executeQuery(
                    `UPDATE task 
                     SET status = ?, progress = ?, updated_at = NOW() 
                     WHERE id = ?`,
                    [status, progress, taskId]
                );
            }
            
            // Отправляем обновление всем подписчикам
            await this.sendTaskUpdate(taskId);
            
            // Если задача завершена, отправляем специальное уведомление
            if (status === 'completed') {
                const [rows] = await this.executeQuery(
                    'SELECT user_id FROM task WHERE id = ?',
                    [taskId]
                );
                
                if (rows.length > 0) {
                    this.sendNotification(
                        rows[0].user_id,
                        'Видео готово!',
                        'success'
                    );
                }
            }
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    }

    async setProcessedTask(ws, kl_task, a_status='ok') {
        await this.executeQuery(
            'UPDATE kling_tasks SET processed = 1 WHERE id = ?',
            [kl_task.id]
        );

        const [rows] = await this.executeQuery(
            "SELECT SUM(`value`) AS balance FROM transactions WHERE `user_id` = ? AND `type` != 'failure'",
            [kl_task.user_id]
        );

        ws.send(JSON.stringify({
            type: 'task_update',
            message: kl_task,
            status: a_status,
            balance: rows ? rows.balance : 0
        }));
    }

    async failureTransaction(user_id, task_id) {

        await this.executeQuery(
            "UPDATE transactions SET type = 'failure' WHERE payload = ? AND type = ?",
            [task_id, 'prepare']
        );

        const [rows] = await this.executeQuery(
            "SELECT SUM(`value`) AS balance FROM transactions WHERE `user_id` = ? AND `type` != 'failure'",
            [user_id]
        );

        await this.executeQuery(
            "UPDATE users SET balance = ? WHERE `id` = ?",
            [rows[0].balance, user_id]
        );

    }

    async setReadNotification(id) {
        return this.executeQuery(
            'UPDATE notifications SET `is_read` = ? WHERE `id` = ?',
            [1, id]
        );
    }

    async watchNotifications() {
        let ids = Array.from(this.clients.keys());
        if (ids.length === 0) {
            return;
        }

        try {
            if (!this.isDbConnected) {
                console.log('Database not connected, skipping watchNotifications');
                return;
            }

            const rows = await this.executeQuery(
                'SELECT * FROM notifications WHERE user_id IN (?) AND is_read = 0',
                [ids.join(',')]
            );

            for (const item of rows) {
                const strid = item.user_id.toString();
                const ws = this.ws(strid);
                if (ws) {
                    try {
                        switch (item.type) {
                            case 'payment':
                                await this.sendBalance(strid);
                                await this.setReadNotification(item.id);
                                break;
                            default:
                                ws.send(JSON.stringify({
                                    type: 'notification',
                                    notify: item
                                }));
                                await this.setReadNotification(item.id);
                                break;
                        }
                    } catch (error) {
                        console.error('Error processing notification:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error in watchNotifications:', error);
        }
    }


    downloadAttempt(ws, item) {

        if (!this.downloadPromises[item.task_id]) {

            console.log(`Attempting download video ${item.result_url}`);
            let promise = downloadWithAxios(item.result_url, this.RESULT_PATH, item.task_id);

            promise.then(async (result) => {
                    if (result.status) {
                        await this.setProcessedTask(ws, item);
                        await this.executeQuery(
                            "UPDATE task SET state = 'finished' WHERE hash = ?",
                            [item.task_id]
                        );
                    }

                    delete this.downloadPromises[item.task_id];
                })

            promise.catch(async (error) => {
                    console.error('Download error:', error);
                    await this.executeQuery(
                        "UPDATE task SET state = 'failure' WHERE hash = ?",
                        [item.task_id]
                    );
                    await this.failureTransaction(item.user_id, item.task_id);
                    await this.setProcessedTask(ws, item, 'download_failed');

                    delete this.downloadPromises[item.task_id];
                });
            this.downloadPromises[item.task_id] = promise;
        }
    }

    async watchTasks() {
        let ids = Array.from(this.clients.keys());
        if (ids.length === 0) {
            return;
        }

        try {
            if (!this.isDbConnected) {
                console.log('Database not connected, skipping watchTasks');
                return;
            }

            let keys = ids.join(',');

            const rows = await this.executeQuery(
                'SELECT kt.*, t.user_id FROM kling_tasks kt ' +
                'INNER JOIN task t ON t.hash = kt.task_id ' +
                `WHERE kt.processed = 0 AND t.user_id IN (${keys})`
            );
            
            for (const item of rows) {
                if (item.user_id) {
                    const ws = this.ws(item.user_id.toString());
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        try {
                            if (item.status === 'succeed' && item.result_url) {
                                this.downloadAttempt(ws, item);                                
                            } else {
                                await this.setProcessedTask(ws, item);
                            }
                        } catch (error) {
                            console.error('Error processing task:', error);
                        }
                    } else console.log(`Client ${item.user_id} not connected`);
                }
            }
        } catch (error) {
            console.error('Error in watchTasks:', error);
        }
    }

    start() {
        this.server.listen(this.port, this.host, () => {
            const os = require('os');
            const networkInterfaces = os.networkInterfaces();
            
            console.log('='.repeat(60));
            console.log('🚀 WEB SOCKET СЕРВЕР ЗАПУЩЕН');
            console.log('='.repeat(60));
            
            console.log('\n🌐 ДОСТУПНЫЕ АДРЕСА ДЛЯ ПОДКЛЮЧЕНИЯ:');
            console.log('-'.repeat(60));
            
            // Локальные адреса
            console.log('Локальный компьютер:');
            console.log(`  ws://localhost:${this.port}`);
            console.log(`  ws://127.0.0.1:${this.port}`);
            
            // Сетевые интерфейсы
            Object.keys(networkInterfaces).forEach((interfaceName) => {
                networkInterfaces[interfaceName].forEach((_interface) => {
                    if (_interface.family === 'IPv4' && !_interface.internal) {
                        console.log(`Сеть (${interfaceName}):`);
                        console.log(`  ws://${_interface.address}:${this.port}`);
                    }
                });
            });

            console.log(`\nWebSocket server started on port ${this.port}`);
            console.log(`WebSocket URL: ${this.protocol}://${this.config.websocket.host || 'localhost'}:${this.port}`);
            console.log(`Database connected: ${this.isDbConnected ? '✅' : '❌'}`);
            
            // Запускаем интервальные проверки
            setInterval(() => { 
                this.watchTasks(); 
                this.watchNotifications();
                
                // Периодическая проверка соединения с БД
                if (this.db && this.isDbConnected) {
                    this.db.ping().catch((error) => {
                        console.log('Database ping failed:', error.message);
                        this.isDbConnected = false;
                        this.reconnectToDatabase();
                    });
                }
            }, 2000);
        });
    }

    // Обновляем graceful shutdown для закрытия БД соединения
    setupGracefulShutdown() {
        const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
        
        signals.forEach(signal => {
            process.on(signal, async () => {
                console.log(`Получен сигнал ${signal}, завершаем работу...`);
                
                // Закрываем WebSocket сервер
                if (this.wss) {
                    this.wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.close(1001, 'Server shutting down');
                        }
                    });
                    this.wss.close();
                }
                
                // Закрываем соединение с БД
                if (this.db && this.isDbConnected) {
                    try {
                        await this.db.end();
                        console.log('Database connection closed');
                    } catch (error) {
                        console.error('Error closing database connection:', error);
                    }
                }
                
                // Закрываем HTTP сервер
                if (this.server) {
                    this.server.close(() => {
                        console.log('HTTP сервер закрыт');
                        process.exit(0);
                    });
                    
                    // Таймаут на закрытие
                    setTimeout(() => {
                        console.log('Принудительное завершение...');
                        process.exit(1);
                    }, 5000);
                } else {
                    process.exit(0);
                }
            });
        });
    }
}

// Запуск сервера
const server = new WebSocketServer();

// Обработка uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение: ', error);
  // Не завершаем процесс, пусть PM2 перезапустит
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанный rejection: ', reason);
  // PM2 перезапустит процесс если нужно
});

// Экспорт для использования в других файлах
module.exports = { WebSocketServer };