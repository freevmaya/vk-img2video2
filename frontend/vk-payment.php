<?php
/**
 * Обработчик платежных уведомлений от VK
 * Документация: https://dev.vk.com/ru/mini-apps/payments/overview
 */

require __DIR__ . '/../engine.php';

header("Content-Type: application/json; encoding=utf-8");

// Логирование
define("PAYMENT_LOG_FILE", LOGPATH . 'vk-payment.log');
define("PAYMENT_ERROR_LOG_FILE", LOGPATH . 'vk-payment-error.log');

// Включаем логирование
if (!defined('ISLOG')) define('ISLOG', true);

/**
 * Проверка подписи уведомления VK
 * @param array $data Данные уведомления
 * @return bool
 */
function verifyVKSignature($data) {
    if (!isset($data['sig'])) {
        logPayment('Отсутствует подпись (sig)', true);
        return false;
    }
    
    $signature = $data['sig'];
    unset($data['sig']);
    
    // Сортируем параметры по алфавиту
    ksort($data);
    
    // Формируем строку для проверки
    $stringToSign = '';
    foreach ($data as $key => $value) {
        $stringToSign .= "{$key}={$value}";
    }
    
    // Получаем секретный ключ приложения
    $secretKey = defined('VK_SECRET_KEY') ? VK_SECRET_KEY : '';
    
    if (empty($secretKey)) {
        logPayment('Секретный ключ VK не настроен', true);
        return false;
    }
    
    $calculatedSignature = md5($stringToSign . $secretKey);
    
    $isValid = hash_equals($calculatedSignature, $signature);
    
    if (!$isValid) {
        logPayment("Неверная подпись. Получено: {$signature}, ожидалось: {$calculatedSignature}", true);
        logPayment("Строка для проверки: {$stringToSign}", true);
    }
    
    return $isValid;
}



function logPayment($message, $isError = false) {
    $logFile = $isError ? PAYMENT_ERROR_LOG_FILE : PAYMENT_LOG_FILE;
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[{$timestamp}] {$message}\n";
    
    if (ISLOG) {
        file_put_contents($logFile, $logMessage, FILE_APPEND);
    }
    
    if ($isError) {
        error_log($logMessage);
    }
}

function get_error_response($text='Неизвестная ошибка') {
    return [
        "error_code" => 20,
        "error_msg" => $text,
        "critical" => true
    ];
}

class PaymentProcess {

    protected $input;
    protected $headers;
    protected $soModel;
    protected $taModel;
    protected $uModel;
    protected $paModel;
    protected $nModel;

    function __construct() {
        $this->soModel  = new SubscribeOptions();
        $this->taModel  = new TransactionsModel();
        $this->uModel   = new VKUserModel();
        $this->paModel  = new VKPaymentsModel();
        $this->nModel  = new NotificationsModel();
    }

    /**
     * Обработка уведомления о платеже
     */
    public function handlePaymentNotification($input, $headers) {
        // Получаем данные
        $this->input = $input;
        $this->headers = $headers;
        
        logPayment("\n=== Новое уведомление ===");
        logPayment("Headers: " . json_encode($this->headers, JSON_FLAGS));
        logPayment("Raw input: " . $this->input);
        
        // Проверяем метод запроса
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            logPayment('Недопустимый метод запроса: ' . $_SERVER['REQUEST_METHOD'], true);
            return json_encode(['error' => 'Method Not Allowed']);
        }
        
        // Парсим данные
        $data = [];
        parse_str($this->input, $data);
        $json_data = json_encode($data, JSON_FLAGS);
        
        logPayment("Parsed data: ".$json_data."\n");

        if (!($wrong_result = $this->wrongData($data))) {

            switch ($data['notification_type']) {
                case 'get_item': 
                    $result = $this->get_item($data);
                    break;
                case 'get_item_test': 
                    $result = $this->get_item($data);
                    break;
                case 'order_status_change': 
                    $result = $this->order_status_change($data);
                    break;
                case 'order_status_change_test': 
                    $result = $this->order_status_change($data);
                    break;
                default: 
                    http_response_code(500);
                    logPayment('Неизвестный "notification_type". Parsed data: '.$json_data, true);
                    $result = get_error_response('Неизвестный "notification_type"');
            }

            http_response_code(200);
            logPayment("Result: ". json_encode($result, JSON_FLAGS));
        } else {
            $result = array_merge(get_error_response(), $wrong_result);
            logPayment("Result: ". json_encode($result, JSON_FLAGS), true);
        }
        return json_encode($result);
    }

    function wrongData($data) {
        
        // Проверяем обязательные параметры
        $requiredParams = ['notification_type', 'app_id', 'user_id', 'sig'];
        foreach ($requiredParams as $param) {
            if (!isset($data[$param])) {
                http_response_code(400);
                return ['error_msg' => "Missing required parameter: {$param}", 'error_code' => 11];
            }
        }
        
        // Проверяем подпись
        if (!verifyVKSignature($data)) {
            http_response_code(403);
            return ['error_msg' => 'Invalid signature', 'error_code' => 10];
        }

        if ($data['app_id'] != VK_APP_ID) {
            http_response_code(403);
            return ['error_msg' => 'Invalid app_id', 'error_code' => 11];
        }

        return false;
    }

    function get_item($data) {
        GLOBAL $dbp;

        $item_id = $data['item'];
        $item = $dbp->line("SELECT id AS item_id, name AS title, price FROM subscribe_options WHERE id={$item_id}");
        if ($item)  
            return [
                "response" => $item
            ];

        return get_error_response("Товара не существует");
    }

    /**
     * Сохранение уведомления в базу данных
     * @param array $data Данные уведомления
     */
    function order_status_change($data) {
        global $dbp;
        
        try {
            // Проверяем, не обрабатывали ли уже этот платеж
            $existingPayment = $this->paModel->getItem($data['order_id'], 'order_id');
            
            if (!empty($existingPayment)) {

                $paymentId = $existingPayment['id'];
                logPayment("Платеж уже существует, ID: " . $paymentId);
                
                // Обновляем статус если изменился
                if ($existingPayment['status'] !== $data['status']) {
                    $this->paModel->Update([
                    	'id' => $paymentId,
                    	'status' => $data['status']
                    ]);

                    logPayment("Статус платежа обновлен на: " . $data['status']);

                    if ($data['status'] == 'refunded')
                        $this->changeBalance($data['user_id'], $data['order_id'], -$data['item_price'], 'refunded', $data);
                    else $this->changeBalance($data['user_id'], $data['order_id'], $data['item_price'], 'subscribe', $data);

                    return [
                        "response" => [
                            "order_id" => $data['order_id'],
                            "app_order_id" => $paymentId
                        ]
                    ];
                } else return [
                            "error" => [
                                "error_code" => 100, 
                                "error_msg" => "Операция уже существует",
                                "critical" => false
                            ]
                        ];
                    //$existingPayment['id'];
            }

            $data['date'] = date('Y-m-d H:i:s', $data['date']);

            $paymentId = $this->paModel->Update($data);
            
            if ($paymentId && ($data['status'] == 'chargeable')) {
                logPayment("Платеж сохранен, ID: {$paymentId}");

                $this->changeBalance($data['user_id'], $data['order_id'], $data['item_price'], 'subscribe', $data);

                return [
                    "response" => [
                        "order_id" => $data['order_id'],
                        "app_order_id" => $paymentId
                    ]
                ];
            }
            
            return get_error_response();
            
        } catch (Exception $e) {
            logPayment("Ошибка сохранения платежа: " . $e->getMessage(), true);            
            return get_error_response();
        }
    }

    function changeBalance($sn_user_id, $payload, $amount, $type, $data) {
        $userId = $this->uModel->getItem($sn_user_id, USERINDEX)['id'];

        $this->taModel->Add($userId, $payload, $amount, $type, $data);
        
        // Обновляем баланс пользователя
        $this->uModel->Update([
            'id' => $userId,
            'balance' => $this->taModel->Balance($userId)
        ]);
        $this->nModel->Update([
            'user_id' => $userId,
            'task_id' => $payload,
            'type' => 'payment',
            'title' => 'Оплата',
            'message' => 'Поступил платеж'
        ]);
    }

    /**
     * Маппинг статуса VK на внутренний статус
     * @param string $vkStatus Статус от VK
     * @return string
     */
    function mapVKStatus($vkStatus) {
        $statusMap = [
            'chargeable' => 'pending',    // Платеж можно провести
            'pending' => 'pending',       // Платеж в обработке
            'completed' => 'completed',   // Платеж завершен
            'failed' => 'failed',         // Платеж не удался
            'refunded' => 'refunded',     // Платеж возвращен
            'canceled' => 'failed',       // Платеж отменен
        ];
        
        return $statusMap[strtolower($vkStatus)] ?? 'pending';
    }

    /**
     * Обработка уведомления в зависимости от типа
     * @param array $data Данные уведомления
     * @param int $paymentId ID платежа в базе
     */
    function processPaymentNotification($data, $paymentId) {
        $notificationType = $data['notification_type'] ?? '';
        $status = mapVKStatus($data['status'] ?? '');
        
        logPayment("Обработка уведомления типа: {$notificationType}, статус: {$status}");
        
        switch ($notificationType) {
            case 'order_status_change':
                handleOrderStatusChange($data, $paymentId);
                break;
                
            case 'transaction_status_change':
                handleTransactionStatusChange($data, $paymentId);
                break;
                
            default:
                logPayment("Неизвестный тип уведомления: {$notificationType}");
                break;
        }
    }

    /**
     * Обработка изменения статуса заказа
     * @param array $data Данные уведомления
     * @param int $paymentId ID платежа
     */
    function handleOrderStatusChange($data, $paymentId) {
        global $dbp;
        
        $status = mapVKStatus($data['status'] ?? '');
        $userId = extractUserIdFromOrder($data['order_id'] ?? '');
        $amount = isset($data['amount']) ? (int)$data['amount'] / 100 : 0;
        
        logPayment("Изменение статуса заказа: статус={$status}, user_id={$userId}, amount={$amount}");
        
        if ($status === 'completed' && $userId > 0 && $amount > 0) {
            // Пополняем баланс пользователя
            
            try {
                // Создаем транзакцию пополнения
                $transactionId = $this->taModel->Update([
                    'user_id' => $userId,
                    'value' => $amount,
                    'time' => date('Y-m-d H:i:s'),
                    'type' => 'deposit',
                    'payload' => json_encode([
                        'payment_id' => $paymentId,
                        'vk_order_id' => $data['order_id'] ?? '',
                        'source' => 'vk_payment'
                    ], JSON_FLAGS)
                ]);
                
                // Обновляем баланс пользователя
                $balance = $this->taModel->Balance($userId);
                $this->uModel->Update([
                    'id' => $userId,
                    'balance' => $balance
                ]);
                
                logPayment("Баланс пользователя {$userId} изменен на {$amount} руб. Новый баланс: {$balance} руб.");
                
                $this->paModel->Update([
                	'id' => $paymentId,
                	'status' => 'completed'
                ]);
                
                // Отправляем уведомление через WebSocket (если настроен)
                sendBalanceUpdateNotification($userId, $balance);
                
            } catch (Exception $e) {
                logPayment("Ошибка пополнения баланса: " . $e->getMessage(), true);
            }
        }
    }

    /**
     * Обработка изменения статуса транзакции
     * @param array $data Данные уведомления
     * @param int $paymentId ID платежа
     */
    function handleTransactionStatusChange($data, $paymentId) {
        // Похожая логика, но для транзакций
        logPayment("Изменение статуса транзакции обработано");
        
        // Можно добавить специфичную логику для транзакций
    }

    /**
     * Извлечение user_id из order_id
     * @param string $orderId Формат: userid_timestamp_random
     * @return int
     */
    function extractUserIdFromOrder($orderId) {
        if (preg_match('/^(\d+)_/', $orderId, $matches)) {
            return (int)$matches[1];
        }
        return 0;
    }

    /**
     * Отправка уведомления об обновлении баланса через WebSocket
     * @param int $userId ID пользователя
     * @param float $balance Новый баланс
     */
    function sendBalanceUpdateNotification($userId, $balance) {
        // Заглушка - здесь должна быть реализация отправки через WebSocket
        // или другие механизмы уведомлений
        
        logPayment("Уведомление для WebSocket: user={$userId}, balance={$balance}");
        
        // Пример реализации через сохранение в базу для последующей обработки cron
        global $dbp;
        try {
            $dbp->prepareAndExecute(
                "INSERT INTO user_notifications (user_id, type, data, created_at) 
                 VALUES (?, 'balance_updated', ?, NOW())",
                [$userId, json_encode(['balance' => $balance])]
            );
        } catch (Exception $e) {
            logPayment("Ошибка сохранения уведомления: " . $e->getMessage(), true);
        }
    }

    /**
     * Проверка активности платежа (для тестирования)
     */
    function testPaymentEndpoint() {
        if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['test'])) {
            logPayment("=== Тестовый запрос ===");
            
            $testData = [
                'user_id' => ADMIN_USERID_VK,
                'notification_type' => 'order_status_change',
                'item_id' => '2',
                'order_id' => time(),
                'status' => 'completed',
                'item_price' => '10000', // 100 руб в копейках
                'item' => 'balance_replenishment',
                'date' => time(),
                'app_id' => 'test_' . time(),
                'sig' => 'test_signature_' . time()
            ];
            
            echo "\nТест обработки платежа VK\n";
            echo print_r($testData, true) . "\n";
            
            // Сохраняем тестовый платеж (без проверки подписи)
            $result = json_encode($this->order_status_change($testData), JSON_FLAGS);
            
            echo "\n✓ Тестовый платеж. {$result}\n";            
            
            // Показываем последние платежи
            $this->showRecentPayments();
            
            exit;
        }
    }

    /**
     * Показать последние платежи (для тестирования)
     */
    function showRecentPayments() {
        global $dbp;
        
        echo "\nПоследние платежи:\n";
        
        try {
            $payments = $dbp->asArray(
                "SELECT * FROM vk_payments ORDER BY `date` DESC LIMIT 10"
            );
            
            if (empty($payments)) {
                echo "Платежей нет\n";
                return;
            }  
            foreach ($payments as $payment)
                echo json_encode($payment, JSON_FLAGS)."\n";
            
        } catch (Exception $e) {
            echo "Ошибка: " . $e->getMessage() . "\n";
        }
    }
}

// Главная функция
function main() {
    global $dbp;
    
    // Инициализация базы данных
    $dbp = new mySQLProvider(_dbhost, _dbname_default, _dbuser, _dbpassword);

    $payObject = new PaymentProcess();
    
    // Тестовый endpoint
    $payObject->testPaymentEndpoint();
    
    // Обработка реальных уведомлений
    echo $payObject->handlePaymentNotification(file_get_contents('php://input'), getallheaders());
    
    $dbp->Close();
}

// Запуск
main();
?>