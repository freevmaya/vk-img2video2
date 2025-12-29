<?php

error_reporting(E_ALL);
// Файл: vk-img2video/frontend/index.php
require_once 'engine.php';

define('AUTH_REQUIRED', false);

session_start();

Page::Run(array_merge($_POST, $_GET));
?>