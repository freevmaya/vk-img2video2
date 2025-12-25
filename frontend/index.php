<?php
// Файл: vk-img2video/frontend/index.php
require_once dirname(__DIR__).'/engine.php';

function isMainApp() {
    
    // 2. Проверка по параметрам VK
    if (((isset($_GET['vk_ok_app_id']) && isset($_GET['vk_ok_user_id'])) || 
         (isset($_GET['vk_app_id']) && isset($_GET['vk_user_id']))) && 
        isset($_GET['sign'])) {
        return true;
    }
    
    return false;
}


// Если не в VK - показываем ошибку или редирект
if (!isMainApp()) {
    http_response_code(403);
    include('templates/vk-only.php'); // Создайте этот шаблон
    exit;
}

if ($sn_user_id = isset($_GET['vk_ok_user_id']) ? $_GET['vk_ok_user_id'] : false)
    define('USERINDEX', 'vk_ok_user_id');
else if ($sn_user_id = isset($_GET['vk_user_id']) ? $_GET['vk_user_id'] : false) 
    define('USERINDEX', 'vk_user_id');
else {
    if (DEV) {
        define('USERINDEX', 'vk_user_id');
        $sn_user_id = ADMIN_USERID_VK;
    } else {
        http_response_code(403);
        include('templates/vk-only.php'); // Создайте этот шаблон
        exit;
    }
}

session_start();
//if (!$sn_user_id) $sn_user_id = isset($_SESSION['sn_user_id']) ? $_SESSION['sn_user_id'] : false;

$_SESSION['USERINDEX'] = USERINDEX;

$auth_token = md5(time().($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'));

// Получение данных пользователя из сессии или VK
$user = null;
$dbp = new mySQLProvider(_dbhost, _dbname_default, _dbuser, _dbpassword);

$userModel = new VKUserModel();

if ($sn_user_id !== false) {
    if ($user = $userModel->getItem($sn_user_id, USERINDEX)) {
        $userModel->Update([
            'id' => $user['id'],
            'accepted_at'=>date('Y-m-d H:i:s')
        ]);
        $userModel->RefreshBalance($user['id']);
    } else {
        $id = $userModel->Update([
            USERINDEX => $sn_user_id,
            'created_at'=>date('Y-m-d H:i:s'),
            'accepted_at'=>date('Y-m-d H:i:s')
        ]);

        $user = $userModel->getItem($id);
    }
    $_SESSION['user_id'] = $user['id'];

} else if (isset($_SESSION['user_id'])) {
    if ($user = $userModel->getItem($_SESSION['user_id']))
        $userModel->RefreshBalance($_SESSION['user_id']);
}

if ($user) {
    define("MOBILE", @$_GET['vk_platform'] == 'mobile_web' ? true : false);
    include('templates/index.php');
}

$dbp->Close();
?>