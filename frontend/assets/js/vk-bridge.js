// Файл: vk-img2video/frontend/assets/js/vk-bridge.js

class VKBridgeHandler {
    constructor() {
        this.bridge = null;
        this.user = null;
        this.isInitialized = false;
        this.selected = null;
        this.currentNotify = null;
        this.notification = null;
    }

    // Инициализация VK Bridge
    async init() {
        try {
            if (typeof vkBridge !== 'undefined') {
                this.bridge = vkBridge;
                
                // Отправляем инициализацию
                await this.bridge.send('VKWebAppInit', {});
                this.isInitialized = true;
                
                console.log('VK Bridge initialized successfully');
                //this.showNotification('VK Bridge успешно инициализирован', 'success');
                
                // Получаем информацию о пользователе
                await this.getUserInfo();
                
                return true;
            } else {
                console.warn('VK Bridge not available, running in browser mode');
                this.showNotification('Режим браузера (не в VK)', 'warning');
                return false;
            }
        } catch (error) {
            console.error('VK Bridge initialization error:', error);
            this.showNotification('Ошибка инициализации VK Bridge', 'error');
            return false;
        }
    }

    updateNotificationsAllowed() {
        if (this.bridge) {

            this.bridge.send('VKWebAppCallAPIMethod', {
                method: 'apps.isNotificationsAllowed', 
                params: {
                    user_id: this.user.id,
                    access_token: this.user.access_token,
                    v: '5.131'
                }
            }).then((data)=>{
                console.log(data);
            });
        }
    }

    async getAccessToken(a_scope) {

        return await this.bridge.send('VKWebAppGetAuthToken', { 
            app_id: VK_APP_ID, 
            scope: a_scope
        }).then( (data) => { 
            if (data.access_token) {
                return data.access_token;
              // Ключ доступа пользователя получен
            }
        }).catch((error) => {
            // Ошибка
            console.error(error);
        });
    }

    async setUserData(userData) {

        this.user = userData;

        this.updateNotificationsAllowed();
        
        console.log('User info received:', userData);
        
        // Отправляем данные на сервер для регистрации/авторизации
        await this.sendUserDataToServer(userData);
    }

    // Получение информации о пользователе
    async getUserInfo() {
        if (!this.bridge || !this.isInitialized) {
            console.warn('VK Bridge not initialized');
            return null;
        }

        try {
            const userData = await this.bridge.send('VKWebAppGetUserInfo', {});
            this.setUserData(userData);
            return userData;
        } catch (error) {
            console.error('Error getting user info:', error);
            return null;
        }
    }

    // Отправка данных пользователя на сервер
    async sendUserDataToServer(userData) {
        try {

            userData['access_token'] = window.auth_token;

            const result = await handlerCall({
                action: 'auth',
                user: userData,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            });
            
            if (result.success) {
                console.log('User data saved on server');
        
                // Сохраняем в localStorage для использования вне VK
                localStorage.setItem('user_id', result.user.id);

                // Обновляем интерфейс
                this.updateUserInterface(result.user);

                WebSocketClient.Initialize();

                app.loadTasks();
            }
        } catch (error) {
            console.error('Error sending user data to server:', error);
        }
    }

    // Обновление интерфейса пользователя
    updateUserInterface(user) {
        $('#userBalance').text(`${user.balance || 0} ₽`);
    }

    async ApiMethod(permission, a_method, a_params) {
        return new Promise((resolve, reject) => {
            let data = ISDEV ? dev_data[a_method] : false;
            if (data) 
                resolve(data);
            else {
                this.getAccessToken(permission).then((token)=>{
                    if (token) {
                        a_params = Object.assign({access_token: token, v: '5.131'}, a_params);
                        this.bridge.send('VKWebAppCallAPIMethod', {method: a_method, params: a_params})
                        .then((data)=>{
                            resolve(data);

                            //console.log(a_method);
                            //console.log(data);
                        })
                        .catch((error) => {

                            //console.log(a_method);
                            //console.log(error);
                            reject(error);
                        });
                    }
                })
                .catch((error) => {
                    console.log(error);
                    reject(error);
                });
            }
        });
    }

    // Открытие фотоальбома VK
    async openVKPhotos() {
        if (!this.user) {
            this.showNotification('Функция доступна только в приложении VK', 'warning');
            return;
        }

        try {

            this.ApiMethod('photos', 'photos.getAlbums', {
                owner_id: this.user.id
            }).then((data)=>{
                this.fillAlbums(data.response.items);
            }); 

            this.ApiMethod('photos', 'photos.get', {
                user_ids: this.user.id,
                album_id: 'wall'
            }).then((data)=>{
                this.fillPhotos(data.response.items);
            });
        } catch (error) {
            console.error('Error opening VK photos:', error);
            this.showNotification('Ошибка при выборе фото', 'error');
        }
    }

    // Обработка выбранных фото
    handleSelectedPhoto(photoElem) {
        app.setSelectedFromAlbum(JSON.parse(photoElem.data('info')));
    }

    fillPhotos(photos) {

        const previewContainer = $('#photosPreviewContainer');
        previewContainer.empty();
        
        // Добавляем новые альбомы
        photos.forEach((photo, index) => {
            let url = photo.sizes[1].url;
            let best = photo.sizes[photo.sizes.length - 1];
            let bigUrl = best;

            let item = $(`<div class='image-preview' style="background-image: url(${url})">
            </div>`);

            item.data('info', JSON.stringify(best));
            item.click(this.onPhotoClick.bind(this));
            previewContainer.append(item);
        });
        $('#albomArea').css('display', 'block');
    }

    onPhotoClick(e) {
        let current = $(e.currentTarget);
        if (this.selected != current) {
            if (this.selected)
                this.selected.removeClass('selected');

            this.selected = current;
            current.addClass('selected');
            this.handleSelectedPhoto(current);
        }
    }

    onAlbumClick(e) {
        let id = $(e.currentTarget).data('id');

        this.ApiMethod('photos', 'photos.get', {
            owner_id: this.user.id,
            album_id: id
        }).then((data)=>{
            this.fillPhotos(data.response.items);
        });
    }

    fillAlbums(albums) {

        const albomArea = $('#albomArea');
        const previewContainer = $('#albumsPreviewContainer');
        previewContainer.empty();
        
        // Добавляем новые альбомы
        albums.forEach((album, index) => {
            
            if (album.size > 0) {
                let albumElem = $(`<div data-id="${album.id}">
                    <div class="album-preview">
                        <div>${album.title}</div>
                    </div>
                </div>`);
                albumElem.click(this.onAlbumClick.bind(this));
                previewContainer.append(albumElem);
            }
        });
        albomArea.css('display', 'block');
        scrollIntoView(previewContainer[0]);
    }

    closeNotification(noShowSame = false) {
        if (this.notification) {
            this.notification.remove();
            this.notification = null;
            if (!noShowSame)
                this.currentNotify = null;
        }
    }

    // Показ уведомления
    showNotification(message, type = 'info') {
        if (this.currentNotify != message) {
            this.currentNotify = message;

            this.closeNotification();

            this.notification = $('<div>', {
                class: `notification ${type}`,
                html: `
                    <div class="d-flex align-items-center p-3">
                        <i class="bi ${this.getNotificationIcon(type)} me-3"></i>
                        <span>${message}</span>
                        <button class="btn-close btn-close-white ms-auto" onclick="vkBridgeHandler.closeNotification(true)"></button>
                    </div>
                `
            });
            this.notification.appendTo('body');
            scrollFromParent($(this.notification));
            
            // Автоматическое удаление через 5 секунд
            setTimeout(this.closeNotification.bind(this), 5000);
        }
    }

    // Получение иконки для уведомления
    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'bi-check-circle';
            case 'error': return 'bi-exclamation-triangle';
            case 'warning': return 'bi-exclamation-circle';
            default: return 'bi-info-circle';
        }
    }

    // Закрытие приложения
    closeApp() {
        if (this.bridge) {
            this.bridge.send('VKWebAppClose', {
                status: 'success'
            });
        }
    }

    // Открытие ссылки в браузере
    openURL(url) {
        if (this.bridge) {
            this.bridge.send('VKWebAppOpenURL', {
                url: url
            });
        } else {
            window.open(url, '_blank');
        }
    }

    // Поделиться результатом
    async shareContent(attachment) {
        if (!this.bridge) {
            this.showNotification('Поделиться можно только в приложении VK', 'warning');
            return;
        }

        try {
            await this.bridge.send('VKWebAppShare', {
                link: attachment.url,
                title: attachment.title,
                text: attachment.text,
                image: attachment.image
            });
            
            this.showNotification('Успешно опубликовано!', 'success');
        } catch (error) {
            console.error('Error sharing content:', error);
            this.showNotification('Ошибка при публикации', 'error');
        }
    }

    // Инициализация платежей
    async initPayment(id, price, description) {
        if (!this.bridge) {
            this.showNotification('Оплата доступна только в приложении VK', 'warning');
            return false;
        }

        try {
            const payment = await this.bridge.send('VKWebAppShowOrderBox', {
                type: 'item', // Всегда должно быть 'item'
                item: id
            })
            .then((data) => {
                console.log(data);
                if (data.status) {
                  // Экран VK Pay показан
            
                    if (data.success) {
                        this.showNotification('Платеж успешно выполнен!', 'success');
                        return true;
                    } else {
                        this.showNotification('Платеж не был завершен', 'warning');
                        return false;
                    }
                }
            })
            .catch((error) => {
                console.log(error);
            });
        } catch (error) {
            console.error('Payment error:', error);
            this.showNotification('Ошибка при оплате', 'error');
            return false;
        }
    }

    // Проверка, запущено ли в VK
    isInVK() {
        return this.bridge !== null && this.isInitialized;
    }

    // Получение текущего пользователя
    getCurrentUser() {
        return this.user;
    }

    showErrorUploadVideo(error) {
        let msg = 'Ошибка загрузки видео: ' + (typeof error === "string" ? error : error.message);
        console.error(msg, error);
        this.showNotification(msg, 'error');
    }

    async publicOnWall(task) {
        return new Promise(async (resolve, reject) => {
            this.uploadVideoToAlbum(task)
            .then((response)=>{
                if (response.success) {
                    this.ApiMethod('wall', 'wall.post', {
                        owner_id: response.owner_id,
                        message: 'Создано в приложении ' + APP_NAME,
                        attachments: `video_${response.owner_id}_${response.video_id}`,
                        link_photo_id: `${response.owner_id}_${response.video_id}`
                    })
                    .then((result)=>{ 
                        if (result.post_id)
                            this.showNotification('Видео успешно опубликовано!', 'success');
                    })
                    .catch((e)=>{
                        this.showErrorUploadVideo(e);
                        reject(e);
                    })
                } else {
                    this.showErrorUploadVideo(e);
                    reject(response);
                }
            })
            .catch((e)=>{
                this.showErrorUploadVideo(e);
                reject(e);
            })
        });
    }

    async uploadVideoToAlbum(task, albumId = null) {
        if (!this.bridge || !this.isInitialized) {
            this.showNotification('Функция доступна только в приложении VK', 'warning');
            return null;
        }
        
        if (!this.user) {
            this.showNotification('Требуется авторизация', 'error');
            return null;
        }

        return new Promise(async (resolve, reject) => {
        
            try {
                let data = {
                    url: task.url,
                    name: 'Мое сгенерированное видео',
                    description: 'По промпту: "' + task.prompt + '. Создано в приложении ' + APP_NAME,
                   // group_id: null, // Для загрузки в группу
                    privacy_view: 'all', // Кто может просматривать
                    privacy_comment: 'all', // Кто может комментировать
                    no_comments: 0, // Разрешить комментарии
                    repeat: 0, // Не повторять видео
                    compression: 1, // Использовать сжатие
                    attachments: 'app' + VK_APP_ID
                };

                if (albumId) data['album_id'] = albumId;

                // 1. Сначала получаем upload_url для загрузки видео
                this.ApiMethod('video', 'video.save', data)
                .then((uploadResponse)=>{                
                
                    if (!uploadResponse.response || !uploadResponse.response.upload_url) {
                        throw new Error('Не удалось получить URL для загрузки видео');
                    }
                    
                    const uploadUrl = uploadResponse.response.upload_url;
                    const videoId = uploadResponse.response.video_id;
                    
                    this.showNotification('Начинаем загрузку видео...', 'info');
                    
                    // 2. Загружаем видео файл на сервер VK
                    this.uploadVideoFile(data.url, uploadUrl, videoId)
                    .then((uploadResult)=>{
                        if (uploadResult.success) {
                            // 3. После успешной загрузки, сохраняем видео
                            this.ApiMethod('video', 'video.save', Object.assign({
                                video_id: videoId,
                                owner_id: this.user.id,
                                attachments: 'app' + VK_APP_ID,
                                is_private: 0
                            }, data))
                            .then((saveResult)=>{                            
                                if (saveResult.response) {
                                    const finalVideoId = saveResult.response.video_id || saveResult.response[0].video_id;
                                    
                                    this.showNotification('Видео успешно загружено в VK!', 'success');
                                    
                                    // 4. Добавляем видео в альбом если указан albumId
                                    if (albumId)
                                        this.addVideoToAlbum(finalVideoId, albumId);

                                    let videoUrl = `https://vk.com/video${this.user.id}_${finalVideoId}`;

                                    handlerCall({
                                        action: 'set_uploadData',
                                        task_id: task.id,
                                        save_result: {
                                            link: videoUrl,
                                            video_id: finalVideoId,
                                            owner_id: this.user.id
                                        }
                                    });
                                    
                                    resolve({
                                        success: true,
                                        video_id: finalVideoId,
                                        owner_id: this.user.id,
                                        link: videoUrl,
                                        message: 'Видео успешно загружено'
                                    });
                                }
                            });
                        }
                    })
                    .catch((error)=>{ 
                        this.showErrorUploadVideo(error);
                        reject({ success: false, error: error.message });
                    });               
                })
                .catch((error)=>{
                    this.showErrorUploadVideo(error);
                    reject({ success: false, error: error.message });
                });
                
            } catch (error) {
                this.showErrorUploadVideo(error);
                reject({ success: false, error: error.message });
            }
        });
    }

    async uploadVideoFile(videoUrl, uploadUrl, videoId) {
        return new Promise(async (resolve, reject) => {
            try {
                // Получаем видео файл
                const response = await fetch(videoUrl);
                const videoBlob = await response.blob();
                
                // Создаем FormData для загрузки
                const formData = new FormData();
                formData.append('video_file', videoBlob, `video_${videoId}.mp4`);
                
                // Отправляем на сервер VK
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'POST',
                    body: formData
                });
                
                const result = await uploadResponse.json();
                
                if (result.video_id) {
                    resolve({
                        success: true,
                        video_id: result.video_id,
                        size: videoBlob.size,
                        duration: result.duration || 0
                    });
                } else {
                    reject(new Error('Ошибка загрузки файла на сервер VK'));
                }
                
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Создаем глобальный экземпляр
const vkBridgeHandler = new VKBridgeHandler();

// Экспортируем для использования в других файлах
if (typeof window !== 'undefined') {
    window.vkBridgeHandler = vkBridgeHandler;
}

// Функции для использования в HTML
function vkLogin() {
    vkBridgeHandler.init();
}

function openVKPhotos() {
    vkBridgeHandler.openVKPhotos();
}

function showNotification(message, type) {
    vkBridgeHandler.showNotification(message, type);
}