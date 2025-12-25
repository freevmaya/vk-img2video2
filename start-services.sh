#!/bin/bash
# Автозапуск PM2 при старте системы
# Путь к проекту: /home/vmaya/www/vk-img2video2

# Ждем немного
sleep 10

# Переходим в проект
cd /home/vmaya/www/vk-img2video2

# Запускаем PM2
pm2 start ecosystem.config.js

# Сохраняем настройки
pm2 save

# Сделайте исполняемым и добавьте в crontab @reboot
# @reboot /home/vmaya/www/vk-img2video2/start-services.sh