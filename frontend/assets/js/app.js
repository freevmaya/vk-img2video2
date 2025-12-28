// Файл: vk-img2video/frontend/assets/js/app.js

class Image2VideoApp {
    constructor() {
        this.selectedImage = null;
        this.currentTask = null;
        this.tasks = [];
        this.avgTaskTime = 0;
        this.subscription = new Subscription();
        
        this.init();

    }

    // Инициализация приложения
    init() {
        //console.log('Image2VideoApp initialized');
        
        // Настройка обработчиков событий
        this.setupEventListeners();
        
        // Проверка авторизации
        // this.checkAuth();
        
        // Загрузка задач
        // this.loadTasks();

        this.initSubscribesDialog();
        this.agreementModal = null;
        this.agreementContent = null;
    }

    // Проверка авторизации
    async checkAuth() {
        try {
            const data = handlerCall({
                action: 'check_auth', 
                auth_token: window.auth_token
            });
            
            if (data.authenticated && data.user) {
                localStorage.setItem('user_id', data.user.id);
                this.updateUserInterface(data.user);
            }
            //webSocketClient.send({ type: 'check_auth', auth_token: window.auth_token });
        } catch (error) {
            console.error('Auth check error:', error);
        }
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Загрузка файлов
        $('#fileInput').on('change', (e) => this.handleFileUpload(e));
    }

    // Обработка загрузки файлов
    handleFileUpload(event) {
        const files = event.target.files;
        if (!files.length) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Проверка типа файла
            if (!this.isValidImage(file)) {
                this.showNotification(`Файл ${file.name} не является изображением`, 'error');
                continue;
            }

            // Проверка размера
            if (file.size > MAX_FILE_SIZE) {
                this.showNotification(`Файл ${file.name} слишком большой`, 'error');
                continue;
            }

            // Чтение и добавление файла
            const reader = new FileReader();

            reader.onload = (e) => {
                console.log(e);
                this.setSelectedFromAlbum({
                    url: e.target.result,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                });
            };
            reader.readAsDataURL(file);
        }

        // Очистка input
        event.target.value = '';
    }

    // Проверка валидности изображения
    isValidImage(file) {
        return ALLOWED_TYPES.includes(file.type);
    }

    // Добавление изображения
    setSelectedFromAlbum(imageInfo) {
        this.selectedImage = imageInfo;
        this.updateImagePreview();
        scrollIntoView($('#previewArea')[0]);
        
        //this.showNotification('Изображение выбрано', 'success');
    }

    // Обновление превью изображений
    updateImagePreview() {
        const container = $('#imagePreviewContainer');
        const previewArea = $('#previewArea');
        
        if (!this.selectedImage) {
            container.html(`
                <div>
                    <i class="bi bi-images display-4 text-muted mb-3"></i>
                    <p class="text-muted">Нет выбранных изображений</p>
                </div>
            `);
            previewArea.hide();
            $('#settingsSection').hide();
            return;
        }

        container.empty();
        
        if (this.selectedImage && this.selectedImage.url) {
            const col = $(`
                <div class="image-preview">
                    <img src="${this.selectedImage.url}">
                </div>
            `);
            
            /*
            col.find('img').on('load', (elem)=>{
                getImageInfo(elem.currentTarget)
                .then(info => {
                    console.log(info);
                });
            });*/
            container.append(col);
            
            col.find('img').on('load', (e)=>{
                previewArea.find('.imagePreviewInfo').text(e.target.naturalWidth + 'x' + e.target.naturalHeight);
            })
        }
        
        previewArea.show();
        if (this.selectedImage)
            $('#settingsSection').show();
        else
            $('#settingsSection').hide();
    }

    // Обновление цены
    updatePrice() {
        $('#priceDisplay').text(strEnum(SITE_PRICE, CURRENCY_PATTERN));
    }

    getFormData(elems) {
        var data = {};
        
        elems.each(function() {
            var $this = $(this);
            var name = $this.attr('name') ?? $this.attr('id');
            var type = $this.attr('type');
            var tag = $this.prop('tagName').toLowerCase();
            
            if (!name) return;
            
            if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
                if (type === 'checkbox')
                    data[name] = $this.is(':checked');
                else if (type === 'radio' && $this.is(':checked'))
                    data[name] = $this.val();
            } else if (tag === 'select' && $this.prop('multiple'))
                data[name] = $this.val() || [];
            else data[name] = $this.val();
        });
        
        return data;
    }

    getSettings() {
        return this.getFormData($('#settingsSection').find('.control'));
    }

    async continueGenerateVideo() {

        try {
            // Показываем индикатор загрузки
            this.showLoading(true);

            let a_settings = this.getSettings();
            
            // Подготавливаем данные
            const taskData = {
                image: this.selectedImage,
                settings: a_settings
            };

            // Отправляем запрос на сервер
            const result = await handlerCall({
                action: 'create_task',
                task: taskData
            });
            
            if (result.success) {
                this.currentTask = result.hash;
                this.tasks.push(result.hash);
                
                this.showNotification('Задание на генерацию создано!', 'success');
                this.addTaskToList(result.hash);
                this.subscription.addTask();

                //vkBridgeHandler.updateNotificationsAllowed();
                $('#settingsSection').hide();
            } else {
                console.error(result.message || 'Ошибка создания задания');
            }
        } catch (error) {
            console.error('Generation error:', error);
            this.showNotification(error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Генерация видео
    async generateVideo() {
        if (!this.selectedImage) {
            this.showNotification('Выберите хотя бы одно изображение', 'error');
            return;
        }

        let a_settings = this.getSettings();
        if (!a_settings.prompt) {
            this.showNotification('Отсутствует промпт для задачи');
            return;
        }

        if (this.subscription.remainedTasks() == 0)
            vkBridgeHandler.initPayment()
                .then((result)=>{
                    if (result)
                        this.continueGenerateVideo();
                });
        else this.continueGenerateVideo();
    }

    // Добавление задачи в список
    addTaskToList(task) {
        const tasksList = $('#tasksList');
        new TaskView(tasksList, task);

        tasksList.find('.attention').remove();
    }

    // Обновление статуса задачи
    updateTaskStatus(hash, status) {
        const taskElement = $(`.task-item[data-task-id="${hash}"]`);
        if (taskElement.length > 0)
            taskElement.data('view').updateProgress(status);
        else {
            handlerCall({action:'get_task', hash: hash})
                .then((result)=>{                    
                    if (result.success && result.task)
                        this.addTaskToList(result.task);
                });
        }
    }

    watchVideo(blockId) {
        let videoElem = $(`#${blockId}`).find('video');
        let video = videoElem[0];

        if (video.requestFullscreen) {
            video.requestFullscreen();
        } else if (video.mozRequestFullScreen) { // Firefox
            video.mozRequestFullScreen();
        } else if (video.webkitRequestFullscreen) { // Chrome, Safari
            video.webkitRequestFullscreen();
        } else if (video.msRequestFullscreen) { // IE/Edge
            video.msRequestFullscreen();
        }

        videoElem.show();
        video.play();

        /*
        const overlay = $('<div>', {
            id: 'fullscreenOverlay',
            class: 'fullscreenOverlay',
            html: '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>'
        });


        $('body').append(overlay);
        */
    }

    // Показ результата видео
    showVideoResult(task) {
        let hash = task.hash ?? task.task_id;

        let block_id = `video-${hash}`;
        const hasBlock = $('#' + block_id);

        if (!hasBlock.length) {
            const videosSection = $('#videosSection');
            const videosGrid = $('#videosGrid');
            
            if (!videosGrid.length || !videosSection.length) return;

            let url = this.getVideoUrl(hash);
            let thumbnail_url = this.getThumbnailUrl(hash);
            
            let videoCard = $(`
                <div class="video-card" id="${block_id}">
                    <div class="video-preview">
                        <div class="bi bi-play-circle" style="background-image: url(${thumbnail_url})" onclick="app.watchVideo('${block_id}')">
                        </div>
                        <video controls class="w-100 hide">
                            <source src="${url}" type="video/mp4">
                            Ваш браузер не поддерживает видео.
                        </video>
                    </div>
                    <div class="p-3">
                        <div class="video-info">
                            <h6>Видео #${hash}</h6>
                            <small class="text-muted">
                                ${new Date(task.completed_at).toLocaleString()}
                            </small>
                        </div>
                        <div class="video-overlay">
                            <div class="video-actions">
                                <button class="btn btn-primary btn-sm" onclick="app.downloadVideo('${hash}')">
                                    <i class="bi bi-download me-1"></i>Скачать
                                </button>
                                <button class="btn btn-success btn-sm" onclick="app.shareVideo('${hash}')">
                                    <i class="bi bi-share me-1"></i>Поделиться
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            
            videosGrid.prepend(videoCard);
            videosSection.show();
        }
    }

    // Скачивание видео
    async downloadVideo(hash) {
        try {
            const url = this.getVideoUrl(hash);
            const a = document.createElement('a');
            a.href = url;
            a.download = `video_${hash}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            this.showNotification('Ошибка при скачивании', 'error');
        }
    }

    // Поделиться видео
    async shareVideo(hash) {
        const task = this.tasks.find(t => t.hash === hash);
        if (!task) return;
        
        /*
        if (vkBridgeHandler.isInVK()) {
            await vkBridgeHandler.shareContent({
                url: task.generated_video_url,
                title: 'Мое сгенерированное видео',
                text: 'Посмотрите, какое видео я создал с помощью AI!',
                image: task.original_image_url
            });
        } else {
            // Копирование ссылки в буфер обмена
            await navigator.clipboard.writeText(task.generated_video_url);
            this.showNotification('Ссылка скопирована в буфер обмена', 'success');
        }*/


        let view = $('#publishModal');
        this.publishModal  = new bootstrap.Modal(view[0]);
        this.publishModal.show();

        let request_data = JSON.parse(task.request_data);
        this.sharedTask = {
            id: task.id,
            hash: hash,
            url: this.getVideoUrl(hash),
            prompt: request_data.prompt
        };

        scrollFromParent(view);
        /*
        if (window.parent != window)
            setTimeout(()=>{
                view.css('top', window.parent.scrollY);
            }, 200);*/
    }

    shareToWall() {
        this.publishModal.hide();
        if (vkBridgeHandler)
            vkBridgeHandler.publicOnWall(this.sharedTask);
    }

    saveToAlbum() {
        this.publishModal.hide();
        if (vkBridgeHandler)
            vkBridgeHandler.uploadVideoToAlbum(this.sharedTask);
    }

    // Загрузка задач
    async loadTasks() {
        return new Promise((resolve, reject) => {            
            try {
                handlerCall({action: 'get_tasks'})
                    .then((result)=>{            
                        if (result.success) {
                            this.tasks = result.tasks;
                            this.updateTasksList();
                            
                            // Показываем готовые видео
                            const completedTasks = result.tasks.filter(t => t.state === 'finished');
                            if (completedTasks.length) {
                                completedTasks.forEach(task => this.showVideoResult(task));
                            }
                        }

                        resolve(result);
                    })
                    .catch((error)=>{
                        console.error('Tasks loading error:', error);
                        reject(error);
                    });
            } catch (error) {
                console.error('Tasks loading error:', error);
                reject(error);
            }
        });
    }

    getVideoUrl(hash) {
        return document.location.origin + '/downloads/results/' + hash + '.mp4';
    }

    getThumbnailUrl(hash) {
        return document.location.origin + '/downloads/thumbnail/' + hash + '.jpg';
    }

    // Обновление списка задач
    updateTasksList() {
        const tasksList = $('#tasksList');
        tasksList.empty();

        let activeTasks = this.tasks.filter(t => t.state === 'active');
        
        if (!activeTasks.length) {
            tasksList.html(`
                <div class="attention">
                    <i class="bi bi-inbox display-4 text-muted mb-3"></i>
                    <p class="text-muted">У вас пока нет активных задач</p>
                </div>
            `);
            return;
        }
        
        activeTasks.forEach(task => this.addTaskToList(task));
    }

    clickSubscriptionBtn() {
        if (this.subscription.data != null) 
            this.subscription.showView();
        else (new bootstrap.Modal($('#subscribeModal')[0])).show();
    }

    // Обработка выбора подписки
    async processSubscribe() {
        let active = $('.payment-option.active');
        if (active.length)
            vkBridgeHandler.VKWebAppShowSubscriptionBox({
                action: 'create',
                item: 'subscription-' + active.data('id')
            });
    }

    // Показ индикатора загрузки
    showLoading(show) {
        const generateBtn = $('#generateBtn');
        
        if (show) {
            generateBtn.prop('disabled', true);
            generateBtn.html(`
                <span class="spinner-border spinner-border-sm me-2"></span>
                Обработка...
            `);
        } else {
            generateBtn.prop('disabled', false);
            generateBtn.html(`
                <i class="bi bi-magic me-2"></i>Создать видео
            `);
        }
    }

    // Показ уведомления
    showNotification(message, type = 'info') {
        if (typeof vkBridgeHandler !== 'undefined') {
            vkBridgeHandler.showNotification(message, type);
        } else {
            // Fallback для браузера
            alert(message);
        }
    }

    // Обновление интерфейса пользователя
    updateUserInterface(user) {
        this.updateSubscribe(user);
    }

    // Выход из системы
    async logout() {
        try {
            await handlerCall({action:'logout'});
            localStorage.removeItem('selected_images');
            window.location.reload();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    initSubscribesDialog() {
        let selected = $('#subscribeModal .payment-option.active');

        function setSelected(ev) {
            let elem = ev.currentTarget;
            if (selected != elem) {
                if (selected) $(selected).removeClass('active');
                selected = elem;
                if (selected) $(selected).addClass('active');
            }
        }

        $('#subscribeModal .payment-option').click(setSelected);
    }

    showModal(content, modalElementOrTitle) {

        let modalElement = $('#modalView');
        if (typeof modalElementOrTitle == 'string')
            modalElement.find('.modal-title span').text(modalElementOrTitle);
        else modalElement = modalElementOrTitle;

        if (modalElement.length) {
            let view = new bootstrap.Modal(modalElement[0]);
            let body = modalElement.find('.modal-body');

            if (content)
                this.loadContent(content, body);
            else body.empty();

            view.show();

            if (vkBridgeHandler.bridge)
                vkBridgeHandler.bridge.send('VKWebAppScroll', {
                    top: 100,
                    speed: 600
                }) 
        }
    }

    showPrivacyModal() {
        if (!this.privacyModal)
            this.privacyModal = new bootstrap.Modal(document.getElementById('privacyModal'));
        
        // Загружаем контент
        this.loadContent('get_privacy', $('#privacyContent'));
        
        // Показываем модальное окно
        this.privacyModal.show();
    }

    showAgreementModal() {
        if (!this.agreementModal)
            this.agreementModal = new bootstrap.Modal(document.getElementById('agreementModal'));
        
        // Загружаем контент
        this.loadContent('get_agreement', $('#agreementContent'));
        
        // Показываем модальное окно
        this.agreementModal.show();
    }

    // Загрузить контент соглашения
    async loadContent(contentFileName, container) {
        try {
            const data = await handlerCall({action: 'get_content', filename: contentFileName});
            
            if (data.success && data.content) {
                container.html(data.content);
                this.applyAgreementStyles(container);
            } else {
                this.showAgreementError(container, data.message || 'Ошибка загрузки');
            }
        } catch (error) {
            console.error('Ошибка загрузки соглашения:', error);
            this.showAgreementError(container, 'Не удалось загрузить');
        }
    }

    // Показать ошибку
    showAgreementError(container, message) {
        container.html(`
            <div class="agreement-error text-center py-5">
                <i class="bi bi-exclamation-triangle display-4 text-danger mb-3"></i>
                <h4>Ошибка</h4>
                <p class="text-muted">${message}</p>
                <button class="btn btn-primary mt-3" onclick="app.loadContent()">
                    <i class="bi bi-arrow-clockwise me-1"></i>Повторить попытку
                </button>
            </div>
        `);
    }

    // Применить стили к загруженному контенту
    applyAgreementStyles(content) {
        
        // Добавляем классы разделам
        content.find('section').addClass('agreement-section fade-in');
        
        // Добавляем иконки к заголовкам
        content.find('h3').each(function(index) {
            $(this).prepend(`<i class="bi bi-${index + 1}-circle me-2"></i>`);
        });        
        // Добавляем анимацию
        content.find('.agreement-section').each(function(index) {
            $(this).css('animation-delay', `${index * 0.1}s`);
        });
    }

    // Печать соглашения
    printAgreement() {
        const printWindow = window.open('', '_blank');
        const content = $('#agreementContent').html();
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <title>Пользовательское соглашение - ${APP_NAME}</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
                    h1 { color: #333; text-align: center; }
                    h3 { color: #667eea; margin-top: 30px; }
                    .agreement-section { margin-bottom: 20px; }
                    @media print {
                        body { font-size: 12pt; }
                    }
                </style>
            </head>
            <body>
                <h1>Пользовательское соглашение</h1>
                <p><strong>Сервис:</strong> ${APP_NAME}</p>
                <hr>
                ${content}
                <hr>
                <p style="text-align: center; margin-top: 50px;">
                    <small>Распечатано: ${new Date().toLocaleString()}</small>
                </p>
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    }

    // Принять соглашение
    acceptAgreement() {
        // Сохраняем в localStorage что пользователь принял соглашение
        localStorage.setItem('agreement_accepted', 'true');
        localStorage.setItem('agreement_accepted_date', new Date().toISOString());
        
        // Закрываем модальное окно
        if (this.agreementModal) {
            this.agreementModal.hide();
        }
        
        // Показываем уведомление
        this.showNotification('Спасибо! Вы приняли пользовательское соглашение.', 'success');
        
        // Отправляем на сервер (опционально)
        this.saveAgreementAcceptance();
    }

    // Сохранить факт принятия соглашения на сервере
    async saveAgreementAcceptance() {
        try {
            await handlerCall({
                action: 'accept_agreement',
                timestamp: new Date().toISOString(),
                version: '1.0' // Версия соглашения
            });
        } catch (error) {
            console.error('Ошибка сохранения принятия соглашения:', error);
        }
    }

    // Проверить, принял ли пользователь соглашение
    checkAgreementAccepted() {
        return localStorage.getItem('agreement_accepted') === 'true';
    }

    // Показать соглашение если оно не было принято
    showAgreementIfNeeded() {
        if (!this.checkAgreementAccepted()) {
            // Можно показать с задержкой
            setTimeout(() => {
                this.showNotification('Пожалуйста, ознакомьтесь с пользовательским соглашением', 'info');
                this.showAgreementModal();
            }, 3000);
        }
    }

    setAvgTaskSpeed(value) {
        this.avgTaskSpeed = value;

        $(`.task-item`).each((i, elem) => {
            $(elem).data('view').resetTimer();
        });
    }

    refreshTasks() {
        this.loadTasks();
        if (webSocketClient && !webSocketClient.isConnected)
            webSocketClient.reconnectImmediately();
    }

    updateForSubscription(data) {
        this.subscription.setData(data);
    }

    ResumeSubscription() {

    }
}

class Subscription {

    setData(sdata) {

        if (this.data && (this.data.status != sdata.status))
            vkBridgeHandler.showNotification('Статус подписки изменился на ' + this.getStatusAliase(sdata.status));
        this.data = sdata;
        sdata.video_limit = toNumber(sdata.video_limit);
        sdata.image_limit = toNumber(sdata.image_limit);
        sdata.task_count = toNumber(sdata.task_count);
        this.update();
    }

    getStatusAliase(status) {
        switch (status) {
            case 'active':
                return 'Активная'
            case 'chargeable':
                return 'Активная'
            case 'cancelled':
                return 'Отменено'
        };
        return status;
    }

    remainedTasks() {
        return this.data ? Math.max(this.data.video_limit - this.data.task_count, 0) : 0;
    }

    active() {
        return this.data && ((this.data.status == 'chargeable') || (this.data.status == 'active'));
    }

    update() {
        $('#priceBlock').css('display', this.remainedTasks() > 0 ? 'none' : 'block')
        let btn = $('#subscription-btn');

        btn.find('i').text(' ' + (this.data ? this.data.video_limit + '/' + this.data.task_count : 'Подписка'));

        let view = $('#modalViewSubscription');

        btn.removeClass('chargeable active cancelled');
        view.removeClass('chargeable active cancelled');

        let aClass = this.remainedTasks() > 0 ? this.data.status : 'over';

        btn.addClass(aClass);
        view.addClass(aClass);

        view.find('.expired').text(`
            С ${this.data.created_at} по ${this.data.expired}
        `);
        view.find('.used').text(`Сделано: ${this.data.task_count}, осталось: ${this.remainedTasks()} видео`);
        view.find('.status').text(this.getStatusAliase(this.data.status));
    }

    addTask() {
        if (this.data) {
            this.data.task_count++;
            this.update();
        }
    }

    showView() {
        let view = $('#modalViewSubscription');
        (new bootstrap.Modal(view[0])).show();
    }

    ResumeSubscription() {        
        vkBridgeHandler.VKWebAppShowSubscriptionBox({
            action: 'resume',
            subscription_id: this.data.vk_subscription_id
        });
    }

    ChangeSubscription() {
        (new bootstrap.Modal($('#subscribeModal')[0])).show();
    }
}

class TaskView {
    constructor(parent, task) {
        this.parent = parent;
        this.task = task;
        this.progress = 0;
        this.tikSpeed = 2;

        this.progress = this.getFixProgress(task.state);
        
        this.element = $(`
            <div class="task-item ${task.state} fade-in" data-task-id="${task.hash}">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5 class="mb-0">Задание #${task.hash}</h5>
                    <span class="badge bg-${this.getStatusColor(task.state)}">
                        ${this.getStatusText(task.state)}
                    </span>
                </div>
                <p class="small mb-2">
                    <i class="bi bi-clock me-1"></i>
                    ${new Date(task.date).toLocaleString()}
                </p>
                <div class="task-progress">
                    <div class="task-progress-bar" style="width: ${this.progress}%"></div>
                </div>
            </div>
        `);

        this.element.data('view', this);        
        this.parent.prepend(this.element);
        this.resetTimer();
    }

    resetTimer() {
        if (this.interval)
            clearInterval(this.interval);

        if (app.avgTaskSpeed > 0)
            this.interval = setInterval(this.onTimer.bind(this), this.tikSpeed * 1000);
    }

    onTimer() {
        if (this.element.closest('body').length) {

            this.progress += app.avgTaskSpeed * this.tikSpeed;
            let p = Math.min(this.progress, 100);
            this.element.find('.task-progress-bar').css('width', `${p}%`);
        } else clearInterval(this.interval);
    }

    getFixProgress(stateOrStatus) {
        switch (stateOrStatus) {
            case 'processing': return 50;
            case 'active': return 50;

            case 'succeed': return 99;
            case 'finished': return 99;
        }
        return 15;
    }

    _setProgress(progress) {
        this.progress = progress;
        this.element.find('.task-progress-bar').css('width', `${progress || 0}%`);
    }

    updateProgress(stateOrStatus) {
        
        this.element
            .removeClass('submitted active processing finished completed failure')
            .addClass(stateOrStatus);
        
        this.element.find('.badge')
            .removeClass('bg-warning bg-primary bg-success bg-danger')
            .addClass(`bg-${this.getStatusColor(stateOrStatus)}`)
            .text(this.getStatusText(stateOrStatus));

        this._setProgress(this.getFixProgress(stateOrStatus));
    }

    // Получение цвета статуса
    getStatusColor(status) {
        switch (status) {
            case 'submitted': return 'warning';

            case 'active': return 'primary';
            case 'processing': return 'primary';

            case 'finished': return 'success';
            case 'succeed': return 'success';

            case 'failure', 'fail': return 'danger';
            default: return 'secondary';
        }
    }

    // Получение текста статуса
    getStatusText(status) {
        switch (status) {
            case 'submitted': return 'Ожидание';

            case 'active': return 'В процессе';
            case 'processing': return 'В процессе';

            case 'finished': return 'Завершено';                
            case 'succeed': return 'Завершено';

            case 'failure', 'fail': return 'Ошибка';
            default: return status;
        }
    }
}


// Глобальные функции для использования в HTML
function openFileUpload() {
    $('#fileInput').click();
}

function logout() {
    if (app) app.logout();
}

function debounce(func, wait) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            func.apply(context, args);
        }, wait);
    };
}

async function handlerCall(params) {

    if (window.auth_token) params = Object.assign({access_token: window.auth_token}, params);

    let response = await fetch('api/vk-handler.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
    });

    const responseForJson = response.clone();
    const responseForText = response.clone();
    const responseForBlob = response.clone();

    try {
        return await responseForJson.json();
    } catch (error) {
        try {
            console.error(await responseForText.text());
        } catch (error) {
            console.error(await responseForBlob.blob());
        }
        return false;
    }
}

function scrollIntoView(_view, delay=200) {
    setTimeout(()=>{
        _view.scrollIntoView({ behavior: 'smooth' });
    }, delay);
}

function scrollFromParent(view, topOffset = 0) {
    if (window.parent != window) {
        if (vkBridgeHandler && vkBridgeHandler.bridge)
            vkBridgeHandler.bridge.send('VKWebAppScrollTop')
            .then((data) => { 
                if (data.scrollTop)
                    view.css('top', data.scrollTop + topOffset);
            });
        else setTimeout(()=>{
            view.css('top', window.parent.scrollY + topOffset);
        }, 300);
    }// else view.addClass();
}

// Константы
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

// Инициализация приложения при загрузке страницы
let app;

$(document).ready(function() {
    app = new Image2VideoApp();
    window.app = app;
    app.updateForSubscription(window.SUBSCRIPTION);
    
    // Инициализация VK Bridge
    if (ISDEV) 
        vkBridgeHandler.setUserData(dev_data['userData']);
    else {
        if (typeof vkBridgeHandler !== 'undefined') {
            vkBridgeHandler.init();
        }
    } 

    let container = $('.dark-theme');
    const resizeObserver = new ResizeObserver(debounce(()=>{
        if (vkBridgeHandler.bridge)
            vkBridgeHandler.bridge.send('VKWebAppResizeWindow', {
                height: container.outerHeight()
            })
    }, 50));
    resizeObserver.observe(container[0]);
});
