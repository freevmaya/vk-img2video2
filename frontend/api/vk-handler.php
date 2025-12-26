<?php
// Файл: vk-img2video/frontend/api/vk-handler.php
require_once __DIR__ . '/../../engine.php';

use App\Services\API\KlingApi;

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Обработка предварительных запросов
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

session_start();

if (!isset($_SESSION['USERINDEX'])) {
    http_response_code(403);
    echo "{'error'=>'Unknown user index'}";
    exit;
}

$dbp = new mySQLProvider(_dbhost, _dbname_default, _dbuser, _dbpassword);

// Получение данных из тела запроса
$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? $input['action'] ?? '';

$response = ['success' => false, 'message' => 'Неизвестное действие'];
$userModel = new VKUserModel();

define('USERINDEX', $_SESSION['USERINDEX']);

try {
    switch ($action) {
        case 'auth':
            $response = handleAuth($input['user'] ?? null);
            break;
        case 'get_subscribeOptions':
            $response = handleGetSubscribeOptions();
            break;
        default:
            if (!checkAccess($input))
                $response = ['success' => false, 'message' => 'Требуется авторизация'];
            else {
                switch ($action) {
                
                    case 'check_auth':
                        $response = handleCheckAuth();
                        break;
                        
                    case 'create_task':
                        $response = handleCreateTask($input['task'] ?? null);
                        break;
                        
                    case 'get_task':
                        $response = handleGetTask($input['id'] ?? null, $input['hash'] ?? null);
                        break;
                        
                    case 'get_tasks':
                        $response = handleGetTasks();
                        break;
                        
                    case 'download_video':
                        $response = handleDownloadVideo($input['id'] ?? null);
                        break;
                        
                    case 'get_balance':
                        $response = handleGetBalance();
                        break;
                        
                    case 'update_balance':
                        $response = handleUpdateBalance($input['amount']);
                        break;
                        
                    case 'logout':
                        $response = handleLogout();
                        break;

                    case 'get_content':
                        $response = handleGetContent($input['filename']);
                        break;
                    /*
                    case 'get_privacy':
                        $response = handleGetContent('privacy-content.html');
                        break;*/

                    case 'accept_agreement':
                        $response = handleAcceptAgreement($input['timestamp'] ?? null, $input['version'] ?? null);
                        break;

                    case 'set_uploadData':
                        $response = handleUploadData($input['task_id'], $input['save_result']);
                        break;
            
                    default:
                        $response['message'] = 'Действие не указано';
                }
            }
            break;
    }
} catch (Exception $e) {
    $response['message'] = 'Ошибка сервера: ' . $e->getMessage();
    error_log($e->getMessage());
}

echo jsonEncodeSafe($response, ['hash', 'task_id']);

$dbp->Close();

function handleGetSubscribeOptions() {
    GLOBAL $dbp;

    return $dbp->asArray('SELECT * FROM subscribe_options');
}

function handleGetContent($template_name) {
    try {
        // Путь к файлу соглашения
        $agreementFile = BASEFRONTPATH.'templates/'.$template_name;
        
        if (!file_exists($agreementFile)) {
            return ['success' => false, 'message' => 'Файл '.$template_name.' не найден'];
        }
        
        // Читаем содержимое файла
        $content = file_get_contents($agreementFile);

        $app_url = $_SESSION['USERINDEX'] == 'vk_user_id' ? VK_APP_URL : OK_APP_URL;

        
        // Заменяем переменные
        $content = str_replace('<!--APP_NAME-->', APP_NAME, $content);
        $content = str_replace('<!--APP_URL-->', $app_url, $content);
        $content = str_replace('<!--SUPPORT_EMAIL-->', SUPPORT_EMAIL, $content);
        $content = str_replace('<!--UPDATE_DOCS-->', UPDATE_DOCS, $content);
        
        return [
            'success' => true,
            'content' => $content,
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Ошибка загрузки '.$template_name.': ' . $e->getMessage()];
    }
}

function handleAcceptAgreement($timestamp, $version) {
    
    try {
        // Сохраняем в базу данных факт принятия соглашения
        (new VKUserModel())->Update([
            'id'=>$_SESSION['user_id'],
            'accepted_at'=>date('Y-m-d H:i:s')
        ]);
        
        return ['success' => true, 'message' => 'Соглашение принято'];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Ошибка сохранения: ' . $e->getMessage()];
    }
}

function jsonEncodeSafe($data, $stringKeys = []) {
    array_walk_recursive($data, function(&$value, $key) use ($stringKeys) {
        if (is_string($value) && is_numeric($value)) {
            // Всегда оставляем как строку, если ключ в списке или есть ведущий ноль
            if (in_array($key, $stringKeys, true) || 
                $value[0] === '0' || 
                strlen($value) > 15) {
                // Ничего не делаем - оставляем строкой
            } else {
                // Можно преобразовать в число для оптимизации
                $value = $value + 0;
            }
        }
    });
    
    return json_encode($data, JSON_UNESCAPED_UNICODE);
}

// Обработчики действий

function handleAuth($userData) {
    GLOBAL $userModel;
    
    if (!$userData || !isset($userData['id'])) {
        return ['success' => false, 'message' => 'Данные пользователя не получены'];
    }
    
    try {
        $user_id        = $_SESSION['user_id'];
        $firstName      = $userData['first_name'] ?? '';
        $lastName       = $userData['last_name'] ?? '';
        $photoUrl       = $userData['photo_200'] ?? '';
        $access_token   = $userData['access_token'] ?? '';

        $user = $userModel->getItem($user_id);
        
        if ($user) {
            $userModel->Update([
                'id'=>$user_id,
                'first_name'=>$firstName,
                'last_name'=>$lastName,
                'photo_url'=>$photoUrl,
                'access_token'=>$access_token
            ]);
            $userId = $user['id'];
        } else {
            return ['success' => false, 'message' => 'Пользователь не найден'];
        }
        
        // Сохраняем в сессию
        $_SESSION['access_token']   = $access_token;
        $_SESSION['timezone']       = $userData['timezone'] ?? 0;
        
        return [
            'success'   => true,
            'message'   => 'Авторизация успешна',
            'user'      => $user,
            'balance'   => (new TransactionsModel())->Balance($user['id']) 
        ];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Ошибка авторизации: ' . $e->getMessage()];
    }
}

function checkAccess($input) {
    return isset($_SESSION['access_token']) && ($_SESSION['access_token'] == @$input['access_token']);
}

function handleCheckAuth() {
    GLOBAL $userModel;

    if (isset($_SESSION['access_token'])) {
        return [
            'success' => true,
            'authenticated' => true,
            'user' => $userModel->getItem($_SESSION['user_id'])
        ];
    }
    
    return [
        'success' => true,
        'authenticated' => false
    ];
}

function handleCreateTask($taskData) {

    GLOBAL $userModel;
    
    if (!$taskData || !isset($taskData['image']) || empty($taskData['image'])) {
        return ['success' => false, 'message' => 'Нет данных для создания задачи'];
    }
    
    try {
        $tmodel = new TransactionsModel();
        // Проверяем баланс пользователя
        $user_id = $_SESSION['user_id'];
        $balance = $tmodel->Balance($user_id);
        $user = $userModel->getItem($user_id);
        
        if (!$user || $balance < ($taskData['price'] ?? 50)) {
            return ['success' => false, 'message' => 'Недостаточно средств на балансе'];
        }
        
        // Сохраняем изображения
        $imageURL = saveImage($taskData['image'], $_SESSION['user_id']);
        
        if (empty($imageURL)) {
            return ['success' => false, 'message' => 'Не удалось сохранить изображения'];
        }

        $api = new KlingApi(KL_ACCESS_KEY, KL_SECRET_KEY, new TaskModel());
        $response = $api->generateVideoFromImage($imageURL, generatePrompt($taskData['settings']));
        
        if (!isset($response['data']['task_id']) || !$response['data']['task_id'])            
            return ['success' => false, 'message' => 'Ошибка создания задачи в Kling API'];

        $hash = $response['data']['task_id'];
        (new VKUserModel())->ChangeBalance($user_id, $hash, -$taskData['price'], 'prepare', $taskData);
        
        return [
            'success' => true,
            'message' => 'Задача создана успешно',
            'hash' => (new TaskModel())->getItem($hash, 'hash')
        ];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Ошибка создания задачи: ' . $e->getMessage()];
    }
}

function generatePrompt($generationParams) {
    //trace($generationParams);
    return $generationParams['prompt'].'. Style: '.$generationParams['styleSelect'].', Camera movement: '.$generationParams['transitionSelect'];
}

function handleGetTask($taskId, $hash = false) {
    global $db;
    
    if (!$taskId && !$hash) {
        return ['success' => false, 'message' => 'ID задачи не указан'];
    }
    
    try {
        
        if ($taskId)
            $task = (new TaskModel())->getItem($taskId);
        else $task = (new TaskModel())->getItem($hash, 'hash');
        
        return [
            'success' => true,
            'task' => $task
        ];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Ошибка получения задачи: ' . $e->getMessage()];
    }
}

function handleGetTasks() {
    global $dbp;
    
    try {

        $timeoffset = 'INTERVAL 0 HOUR';//sprintf('+%02d:00', isset($_SESSION['timezone']) ? $_SESSION['timezone'] : 0);

        $tasks = $dbp->asArray("SELECT t.*, DATE_ADD(t.`date`, {$timeoffset}) AS `date`, DATE_ADD(kt.completed_at, {$timeoffset}) AS completed_at FROM task t ".
            "LEFT JOIN kling_tasks kt ON kt.task_id = t.hash AND kt.status = 'succeed' ".
            "WHERE t.user_id = {$_SESSION['user_id']} LIMIT 9");

        /*
        $tasks = (new TaskModel())->getItems(['user_id' => $_SESSION['user_id']]);
        
        // Добавляем прогресс для каждой задачи
        foreach ($tasks as &$task) {
            $task['progress'] = getKlingTaskProgress($task['hash']);
        }*/
        
        return [
            'success' => true,
            'tasks' => $tasks
        ];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Ошибка получения задач: ' . $e->getMessage()];
    }
}

function handleDownloadVideo($taskId) {
    
    if (!$taskId) {
        return ['success' => false, 'message' => 'ID задачи не указан'];
    }
    
    try {
        global $db;
        
        $stmt = $db->prepare("
            SELECT generated_video_url FROM video_tasks 
            WHERE id = ? AND user_id = ? AND status = 'completed'
        ");
        $stmt->execute([$taskId, $_SESSION['user_id']]);
        $task = $stmt->fetch();
        
        if (!$task || !$task['generated_video_url']) {
            return ['success' => false, 'message' => 'Видео не найдено или еще не готово'];
        }
        
        $filePath = UPLOAD_DIR . basename($task['generated_video_url']);
        
        if (!file_exists($filePath)) {
            return ['success' => false, 'message' => 'Файл видео не найден на сервере'];
        }
        
        // Отправляем файл для скачивания
        header('Content-Description: File Transfer');
        header('Content-Type: video/mp4');
        header('Content-Disposition: attachment; filename="video_' . $taskId . '.mp4"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($filePath));
        readfile($filePath);
        exit;
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Ошибка скачивания: ' . $e->getMessage()];
    }
}

function handleGetBalance() {
    
    try {        
        return [
            'success' => true,
            'balance' => (new TransactionsModel())->Balance($_SESSION['user_id'])
        ];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Ошибка получения баланса: ' . $e->getMessage()];
    }
}

function handleUpdateBalance($amount) {
    
    try {

        $id = $_SESSION['user_id'];
        $tmodel = new TransactionsModel();
        $result = $tmodel->Update([
            'user_id'=>$id,
            'value'=>$amount,
            'time'=>date('Y-m-d H:i:s')
        ]);

        $balance = $tmodel->Balance($id);

        (new VKUserModel())->Update([
            'id'=>$id,
            'balance'=>$balance
        ]);

        return [
            'success' => $result,
            'balance' => $balance
        ];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Ошибка добавления транзакции: ' . $e->getMessage()];
    }
}

function handleLogout() {
    session_destroy();
    return ['success' => true, 'message' => 'Выход выполнен успешно'];
}

function handleUploadData($task_id, $result) {
    $model = new PublicationsModel();

    $result = $model->Update([
        'task_id' => $task_id,
        'data' => $result
    ]);

    return ['success' => $result, 'message' => 'Статус публикации принят'];
}

// Вспомогательные функции

function saveImage($imageInfo, $userId) {

    if (isset($imageInfo['url']) && $imageInfo['url']) {

        if (preg_match('/^data:image\/(\w+);base64,/', $imageInfo['url'], $matches)) {

            // Извлекаем данные из base64
            $extension = $matches[1];
            $data = substr($imageInfo['url'], strpos($imageInfo['url'], ',') + 1);
            $data = base64_decode($data);           
            
        } else {
            $path = parse_url($imageInfo['url'], PHP_URL_PATH);
            $extension = pathinfo($path, PATHINFO_EXTENSION);

            $data = file_get_contents($imageInfo['url']);
        }

        if ($data === false) {
            return null;
        }
        
        // Генерируем имя файла
        $filename = 'user_' . $userId . '_' . time() . '.' . $extension;
        $filepath = DOWNLOADS_USERS_PATH . $filename;
        
        // Сохраняем файл
        if (file_put_contents($filepath, $data)) {
            return DOWNLOADS_USERS_URL.$filename;
        }
    }
    
    return null;
}

function getKlingTaskProgress($taskId) {
    // Здесь должна быть реализация получения прогресса из Kling API
    // Возвращаем случайное значение для примера
    return rand(0, 100);
}
?>