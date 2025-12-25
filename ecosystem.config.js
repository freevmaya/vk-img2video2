module.exports = {
  apps: [
    {
      name: 'vk-websocket',
      script: 'backend/websocket-server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        WS_PORT: 8080
      },
      
      // === КОНФИГУРАЦИЯ ПЕРЕЗАГРУЗКИ ПРИ СБОЕ ===
      
      // Стратегия перезапуска
      exec_mode: 'fork', // fork для одного процесса
      kill_timeout: 5000, // Время на graceful shutdown (5 сек)
      wait_ready: true, // Ждать сигнала ready от приложения
      listen_timeout: 3000, // Таймаут ожидания ready сигнала
      
      // Настройки перезапуска
      max_restarts: 10, // Максимум перезапусков
      min_uptime: '10s', // Минимальное время работы для стабильности
      restart_delay: 3000, // Задержка перед перезапуском (3 сек)
      
      // Экспоненциальная задержка перезапуска
      exp_backoff_restart_delay: 100, // Начальная задержка
      max_restart_delay: 60000, // Максимальная задержка (60 сек)
      
      // Мониторинг
      error_file: './logs/websocket-error.log', // Лог ошибок
      out_file: './logs/websocket-out.log', // Лог вывода
      log_date_format: 'YYYY-MM-DD HH:mm:ss', // Формат даты
      combine_logs: true, // Объединить логи
      merge_logs: true, // Объединять логи при кластеризации
      
      // PID файл
      pid_file: './tmp/websocket.pid',
      
      // Переменные окружения для разных сред
      env_production: {
        NODE_ENV: 'production',
        WS_PORT: 8080,
        MAX_RECONNECT_ATTEMPTS: 50
      },
      env_development: {
        NODE_ENV: 'development',
        WS_PORT: 8081,
        DEBUG: 'websocket:*'
      },

      // Аварийные действия
      pmx: true, // Включить мониторинг
      vizion: true, // Отслеживание версий
      
      // Автоматические действия при проблемах
      post_update: ["npm install", "echo 'Обновление завершено'"],
      
      // Максимальное количество перезапусков за период
      max_restarts: 10,
      
      // Уведомления (если настроены)
      notify: {
        on_restart: true,
        on_error: true
      },
      
      // Интеграция с мониторингом
      source_map_support: true,
      node_args: [
        '--max-old-space-size=1024',
        '--trace-warnings'
      ]

      /*,

      notifications: {
        slack: {
          webhook: "https://hooks.slack.com/services/...",
          channel: "#server-alerts"
        },
        email: {
          to: "fwadim@mail.ru",
          from: "pm2@vk-img2video.vmaya.ru"
        }
      }*/
    }
  ]
};