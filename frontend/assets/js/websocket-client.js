// Файл: vk-img2video/frontend/assets/js/websocket-client.js

class WebSocketClient {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnected = false;
        this.messageHandlers = new Map();
        
        this.init();
    }

    // Инициализация WebSocket
    init() {
        const isssl = window.location.protocol === 'https:';

        const protocol = isssl ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${SOCKET_ADDRESS}`;
        
        console.log('Connecting to WebSocket:', wsUrl);
        this.connect(wsUrl);
        
        // Регистрируем обработчики по умолчанию
        this.registerDefaultHandlers();
    }

    // Подключение к WebSocket серверу
    connect(url) {
        try {
            // Получаем user_id из localStorage или сессии
            const userId = localStorage.getItem('user_id') || 
                          (window.app && window.app.user ? window.app.user.id : null);

            let timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            // Добавляем параметры аутентификации в URL
            const authUrl = userId && window.auth_token ? 
                `${url}?userId=${userId}&token=${window.auth_token}&timeZone=${timeZone}` : 
                url;
            
            this.socket = new WebSocket(authUrl);
            
            this.socket.onopen = () => this.onOpen();
            this.socket.onmessage = (event) => this.onMessage(event);
            this.socket.onclose = () => this.onClose();
            this.socket.onerror = (error) => this.onError(error);
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.attemptReconnect();
        }
    }

    // Обработчик открытия соединения
    onOpen() {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        this.send({
            type: 'auth',
            token: window.auth_token
        });
        $('#btn-refresh').hide();
        
        //this.showNotification('Соединение с сервером установлено', 'success');
    }

    // Обработчик сообщений
    onMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            // Вызываем зарегистрированные обработчики
            if (this.messageHandlers.has(data.type)) {
                this.messageHandlers.get(data.type).forEach(handler => {
                    handler(data);
                });
            } else  console.log(`WebSocket not have handler ${data.type}. Message received:`, data);
            
            // Вызываем глобальные обработчики
            if (typeof window.handleWebSocketMessage === 'function') {
                window.handleWebSocketMessage(data);
            }
        } catch (error) {
            console.error('WebSocket message parsing error:', error);
        }
    }

    // Обработчик закрытия соединения
    onClose() {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
        } else {
            this.showNotification('Ошибка соединения с сервером', 'error');
        }
        $('#btn-refresh').show();
    }

    // Обработчик ошибок
    onError(error) {
        console.error('WebSocket error:', error);
        this.showNotification('Ошибка соединения с сервером', 'error');
        $('#btn-refresh').show();
    }

    reconnectImmediately() {
        if (!this.isConnected) {
            this.connect(this.socket.url);
        }
    }

    // Попытка переподключения
    attemptReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
        
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(this.reconnectImmediately.bind(this), delay);
    }

    // Отправка сообщения
    send(message) {

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
            return true;
        }
        else setTimeout(this.send.bind(this, message), 100);
    }

    // Регистрация обработчика сообщений
    on(messageType, handler) {
        if (!this.messageHandlers.has(messageType)) {
            this.messageHandlers.set(messageType, []);
        }
        this.messageHandlers.get(messageType).push(handler);
    }

    // Удаление обработчика
    off(messageType, handler) {
        if (this.messageHandlers.has(messageType)) {
            const handlers = this.messageHandlers.get(messageType);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    task_update(data) {
        if (typeof app !== 'undefined') {
            let task = data.message;
            app.updateTaskStatus(task.task_id, data.status === 'download_failed' ? 'failure' : task.status);

            if (data.status === 'download_failed') {
                this.showNotification('Ошибка загрузки видео', 'error');
            } else if (task.status === 'succeed') {
                app.showVideoResult(task);
                this.showNotification('Видео готово!', 'success');
            } else if (task.status === 'failed') {
                this.showNotification('Ошибка генерации видео', 'error');
            }
        }
    }

    connection_established(data) {
        if (data.avgTaskSpeed && app) app.setAvgTaskSpeed(data.avgTaskSpeed);
    }

    // Регистрация обработчиков по умолчанию
    registerDefaultHandlers() {
        // Обработчик обновления статуса задачи
        this.on('task_update', this.task_update.bind(this));

        this.on('connection_established', this.connection_established.bind(this));
        
        // Обработчик нового видео
        this.on('new_video', (data) => {
            if (typeof app !== 'undefined') {
                app.showVideoResult(data.task);
            }
        });
        
        this.on('system_notification', (data) => {
            this.showNotification(data.message, data.type || 'info');
        });
        
        this.on('notification', (data) => {
            console.log('Notification: ', data);
        });
    }

    // Показ уведомления
    showNotification(message, type = 'info') {
        vkBridgeHandler.showNotification(message, type);
    }

    // Получение заголовка уведомления
    getNotificationTitle(type) {
        switch (type) {
            case 'success': return 'Успех!';
            case 'error': return 'Ошибка!';
            case 'warning': return 'Внимание!';
            default: return 'Информация';
        }
    }

    // Подписка на обновления задачи
    subscribeToTask(taskId) {
        this.send({
            type: 'subscribe',
            task_id: taskId
        });
    }

    // Отписка от обновлений задачи
    unsubscribeFromTask(taskId) {
        this.send({
            type: 'unsubscribe',
            task_id: taskId
        });
    }

    // Запрос текущего баланса
    requestBalance() {
        this.send({
            type: 'get_balance'
        });
    }

    // Проверка состояния соединения
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            readyState: this.socket ? this.socket.readyState : null,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    // Закрытие соединения
    close() {
        if (this.socket) {
            this.socket.close();
        }
    }
}

// Глобальный экземпляр WebSocket клиента
let webSocketClient = null;

WebSocketClient.Initialize = ()=>{
    // Создаем WebSocket клиент только если поддерживается
    if ('WebSocket' in window || 'MozWebSocket' in window) {
        webSocketClient = new WebSocketClient();
        window.webSocketClient = webSocketClient;
    } else {
        console.warn('WebSocket не поддерживается браузером');
        // Fallback на polling
        startPolling();
    }
}

// Fallback polling для браузеров без WebSocket
function startPolling() {
    console.log('Starting polling as WebSocket fallback');
    
    setInterval(async () => {
        try {
            // Проверяем обновления задач
            if (typeof app !== 'undefined' && app.tasks && app.tasks.length) {
                const pendingTasks = app.tasks.filter(t => 
                    t.status === 'active'
                );
                
                for (const task of pendingTasks) {
                    const result = handlerCall({action:'get_task', id:task.hash});
                    
                    if (result.success && result.task) {
                        const updatedTask = result.task;
                        
                        if (updatedTask.state !== task.state) {
                            app.updateTaskStatus(task.hash, updatedTask.state);
                            
                            if (updatedTask.state === 'finished') {
                                app.showVideoResult(updatedTask);
                                showNotification('Видео готово!', 'success');
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 10000); // Проверка каждые 10 секунд
}

// Глобальная функция для обработки сообщений WebSocket
window.handleWebSocketMessage = function(data) {
    
    // Дополнительная обработка может быть добавлена здесь
    switch (data.type) {
        case 'ping':
            // Ответ на ping
            if (webSocketClient) {
                webSocketClient.send({ type: 'pong' });
            }
            break;
        case 'maintenance':
            // Уведомление о техобслуживании
            showNotification('Сервер будет отключен для технического обслуживания', 'warning');
            break;
    }
};

// Вспомогательная функция для показа уведомлений
function showNotification(message, type = 'info') {
    if (webSocketClient) {
        webSocketClient.showNotification(message, type);
    } else if (typeof vkBridgeHandler !== 'undefined') {
        vkBridgeHandler.showNotification(message, type);
    } else {
        alert(message);
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WebSocketClient };
}