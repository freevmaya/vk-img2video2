<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Доступ ограничен</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            height: 100vh;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
        }
        .container {
            text-align: center;
            max-width: 600px;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 20px;
        }
        p {
            font-size: 1.2rem;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        .vk-button {
            display: inline-block;
            background: #4a76a8;
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            text-decoration: none;
            font-size: 1.1rem;
            font-weight: 500;
            transition: all 0.3s;
        }
        .vk-button:hover {
            background: #5a86b8;
            transform: translateY(-2px);
        }
        .icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        .qr-code {
            margin-top: 30px;
            padding: 20px;
            background: white;
            border-radius: 10px;
            display: inline-block;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🚫</div>
        <h1>Приложение доступно только в VK</h1>
        <p>Это приложение работает исключительно внутри социальной сети ВКонтакте как мини-приложение.</p>
        <p>Для использования откройте приложение через ВКонтакте:</p>
        
        <div style="margin: 30px 0;">
            <a href="https://vk.com/app<?php echo APP_ID['vk']; ?>" class="vk-button">
                🔗 Открыть в VK
            </a>
        </div>
        
        <p style="font-size: 0.9rem; opacity: 0.8;">
            Или отсканируйте QR-код для быстрого доступа:
        </p>
        
        <div class="qr-code">
            <?php 
            // Генерация QR-кода с ссылкой на приложение
            $appUrl = "https://vk.com/app" . APP_ID['vk'];
            $qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" . urlencode($appUrl);
            ?>
            <img src="<?php echo $qrUrl; ?>" alt="QR Code" width="150" height="150">
        </div>
        
        <div style="margin-top: 30px; font-size: 0.9rem; opacity: 0.7;">
            <p>ID приложения: <strong><?php echo APP_ID['vk']; ?></strong></p>
            <p>Если вы разработчик, установите <code>DEV = true</code> в config.php</p>
        </div>
    </div>
</body>
</html>