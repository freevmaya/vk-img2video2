<?
    $updateVer = 7;
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title><?php echo APP_NAME; ?> - Превращаем фото в видео</title>
    
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.1/font/bootstrap-icons.css">
    
    <!-- VK Bridge -->
    <script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>
    
    <!-- jQuery -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    
    <!-- Custom CSS -->
    <link href="assets/css/styles.css?v=<?=$updateVer?>" rel="stylesheet">
    <link href="assets/css/media.css?v=<?=$updateVer?>" rel="stylesheet">
    <?if (MOBILE) {?>
    <link href="assets/css/mobile.css?v=<?=$updateVer?>" rel="stylesheet">
    <?} else {?>
    <link href="assets/css/desktop.css?v=<?=$updateVer?>" rel="stylesheet">
    <?}?>
    <link href="assets/css/animations.css?v=<?=$updateVer?>" rel="stylesheet">
    <link href="assets/css/modals.css?v=<?=$updateVer?>" rel="stylesheet">
    
    <!-- WebSocket полифилл для старых браузеров -->
    <script>
        if (!window.WebSocket && window.MozWebSocket) {
            window.WebSocket = window.MozWebSocket;
        }
    </script>
</head>
<body class="dark-theme">
    <!-- Основной контейнер -->
    <div class="container-fluid glass-container">
        
        <!-- Шапка приложения -->
        <header class="app-header py-3">
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <div class="logo-icon me-3">
                        <i class="bi bi-camera-reels"></i>
                    </div>
                    <h1 class="gradient-text mb-0"><?php echo APP_NAME; ?></h1>
                </div>
                
                <div class="user-section" id="userSection">
                    <div class="d-flex align-items-center">
                        <div class="user-balance">
                            <span class="balance-amount" id="userBalance"></span>
                            <button class="btn btn-sm btn-outline-primary ms-2" onclick="showPaymentModal()">
                                <i class="bi bi-plus-circle"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <!-- Основной контент -->
        <main class="main-content">
            <!-- Секция загрузки изображений -->
            <section class="upload-section vmb">
                <div class="glass-card vblock">
                    <h2 class="section-title vmb-4">
                        <i class="bi bi-cloud-upload me-2"></i>Загрузите фото
                    </h2>
                    
                    <div class="row">
                        <div class="vmb-4">
                            <div class="upload-method-card text-center" onclick="openVKPhotos()">
                                <div class="method-icon">
                                    <i class="bi bi-images"></i>
                                </div>
                                <h3>Из альбома</h3>
                                <p class="text-muted">Выберите фото из ваших альбомов</p>
                            </div>
                        </div>
                        
                        <div class="vmb-4">
                            <input type="file" style="display:none" id="fileInput">
                            <div class="upload-method-card text-center" onclick="openFileUpload()">
                                <div class="method-icon">
                                    <i class="bi bi-upload"></i>
                                </div>
                                <h3>Загрузить файл</h3>
                                <p class="text-muted">Загрузите фото с вашего устройства</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Область альбома -->
                    <div class="preview-area mt-4" id="albomArea" style="display: none;">
                        <div id="albumsPreviewContainer">
                        </div>
                        <div class="row" id="photosPreviewContainer">
                            <!-- Преьюшки будут добавляться динамически -->
                        </div>
                    </div>
                </div>
            </section>

            <!--Секция превьюшки фото-->
            <section class="upload-section vmb" id="previewArea" style="display: none;">
                <div class="glass-card vblock">
                    <h2 class="section-title vmb-4">
                        <i class="bi bi-card-image me-2"></i>Предпросмотр
                    </h2>
                    <div id="imagePreviewContainer">
                    </div>
                    <div class="imagePreviewInfo">
                    </div>
                </div>
            </section>

            <!-- Секция настроек генерации -->
            <section class="settings-section vmb" id="settingsSection" style="display: none;">
                <div class="glass-card vblock">
                    <h2 class="section-title vmb-4">
                        <i class="bi bi-sliders me-2"></i>Настройки генерации
                    </h2>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label" for="prompt">Промпт. Это текстовое описание того, что вы хотите чтобы ИИ сгенерировал из вашего видео.</label>
                                <textarea class="form-control control" type="text" name="prompt" class=""></textarea>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            
                            <div class="mb-3">
                                <label class="form-label" for="styleSelect">Стиль анимации</label>
                                <select class="form-select control" name="styleSelect">
                                    <option value="cinematic">Кинематографичный</option>
                                    <option value="smooth">Плавный</option>
                                    <option value="dynamic">Динамичный</option>
                                    <option value="artistic">Художественный</option>
                                </select>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label" for="transitionSelect">Движение камеры</label>
                                <select class="form-select control" name="transitionSelect">
                                    <option value="fade">Плавное</option>
                                    <option value="slide">Скольжение</option>
                                    <option value="zoom">Увеличение</option>
                                    <option value="rotate">Вращение</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="price-display text-center">
                        <h4>Стоимость: <span class="text-primary" id="priceDisplay">50 ₽</span></h4>
                        <small class="text-muted">Списание произойдет после генерации</small>
                    </div>
                    <div class="mt-3 footer">
                        <button class="btn btn-primary me-2" onclick="generateVideo()" id="generateBtn">
                            <i class="bi bi-magic me-2"></i>Создать видео
                        </button>
                    </div>
                </div>
            </section>

            <!-- Секция статуса задач -->
            <section class="tasks-section" id="tasksSection">
                <div class="glass-card vblock">
                    <h2 class="section-title vmb-4">
                        <i class="bi bi-hourglass-split me-2"></i>Мои задачи
                    </h2>
                    <div>
                        <div class="tasks-list" id="tasksList">
                        </div>
                        <button class="btn btn-primary me-2 pull-right" id="btn-refresh" style="display:none" onclick="app.refreshTasks()"><i class="bi bi-arrow-repeat me-2"></i>Обновить</button>
                    </div>
                </div>
            </section>

            <!-- Секция готовых видео -->
            <section class="videos-section vmt" id="videosSection" style="display: none;">
                <div class="glass-card vblock">
                    <h2 class="section-title vmb-4">
                        <i class="bi bi-film me-2"></i>Готовые видео
                    </h2>
                    
                    <div class="row" id="videosGrid">
                        <!-- Видео будут добавляться динамически -->
                    </div>
                </div>
            </section>
        </main>

        <!-- Футер -->
        <footer class="app-footer text-center">
            <div class="container">
                <p class="mb-2">&copy; <?php echo date('Y'); ?> <?php echo APP_NAME; ?>. Все права защищены.</p>
                <p class="text-muted small">
                    <a href="#" class="text-muted text-decoration-none me-3" onclick="app.showAgreementModal()">Пользовательское соглашение</a>
                    <a href="#" class="text-muted text-decoration-none me-3" onclick="app.showPrivacyModal()">Политика конфиденциальности</a>
                    <a href="mailto:<?=SUPPORT_EMAIL?>" class="text-muted text-decoration-none">Техническая поддержка</a>
                </p>
            </div>
        </footer>
    </div>

    <!-- Модальные окна -->
    <div class="modal fade" id="paymentModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-top">
            <div class="modal-content glass-modal">
                <div class="modal-header">
                    <h5 class="modal-title">Пополнение баланса</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="payment-options" id="payment-block">
                    </div>
                    <input type="hidden" id="selectedAmount" value="250">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                    <button type="button" class="btn btn-primary" onclick="processPayment(); hidePaymentModal();">Оплатить</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Модальное окно пользовательского соглашения -->
    <div class="modal fade" id="agreementModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
            <div class="modal-content glass-modal">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="bi bi-file-text me-2"></i>Пользовательское соглашение
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body" id="agreementContent">
                    <!-- Контент будет загружен динамически -->
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="bi bi-x-circle me-1"></i>Закрыть
                    </button>
                    <button type="button" class="btn btn-outline-primary" onclick="app.printAgreement()">
                        <i class="bi bi-printer me-1"></i>Печать
                    </button>
                    <button type="button" class="btn btn-primary" onclick="app.acceptAgreement()">
                        <i class="bi bi-check-circle me-1"></i>Принимаю условия
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Модальное окно пользовательского соглашения -->
    <div class="modal fade" id="privacyModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
            <div class="modal-content glass-modal">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="bi bi-file-text me-2"></i>Политика конфиденциальности
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body" id="privacyContent">
                    <!-- Контент будет загружен динамически -->
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="bi bi-x-circle me-1"></i>Закрыть
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Модальное окно публикации видео -->
    <div class="modal fade" id="publishModal" tabindex="-1" aria-hidden="true" role="dialog">
        <div class="modal-dialog modal-dialog-top" style="width:500px">
            <div class="modal-content glass-modal">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="bi bi-file-text me-2"></i>Опубликовать видео
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body" id="publishContent">
                    <div class="payment-options" id="payment-block">
                        <div class="payment-option" onclick="app.shareToWall()">На стене
                        </div>
                        <div class="payment-option" onclick="app.saveToAlbum()">В альбоме
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="bi bi-x-circle me-1"></i>Закрыть
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Загрузка скриптов -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script src="assets/js/vk-bridge.js?v=<?=$updateVer?>"></script>
    <script src="assets/js/websocket-client.js?v=<?=$updateVer?>"></script>
    <script src="assets/js/app.js?v=<?=$updateVer?>"></script>
    <script src="assets/js/utils.js?v=<?=$updateVer?>"></script>
    
    <!-- Инициализация приложения -->
    <script>
<?if (DEV) {?>
    var dev_data = {};
<?
    $files = scandir(ASSETS_PATH.'data/');
    foreach ($files as $file) {
        if (str_contains($file, '.json') && ($name = basename($file, '.json')))
            echo "dev_data['{$name}'] = ".file_get_contents(ASSETS_PATH.'data/'.$file).";\n";
    }
}?>
        window.auth_token = '<?=$auth_token;?>';
        var VK_APP_ID = <?=VK_APP_ID?>;
        var APP_NAME = '<?=APP_NAME?>';
        var SUPPORT_EMAIL = '<?=SUPPORT_EMAIL?>';
        var ISDEV = <?=DEV ? 'true' : 'false'?>;

        $(document).ready(function() {
            // Инициализация VK Bridge если мы в VK
            <?if (!DEV) {?>
                if (typeof vkBridge !== 'undefined') {
                    vkBridge.send('VKWebAppInit', {});
                }
            <?}?>
            
            // Загрузка данных пользователя и задач
            // loadUserData();
            // loadTasks();
        });
    </script>
</body>
</html>