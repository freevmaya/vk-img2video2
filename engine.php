<?

	include_once(__DIR__ . '/vendor/autoload.php');	
	include('config.php');

	include(INCLUDE_PATH.DS."_edbu2.php");
	include(INCLUDE_PATH.DS."console.php");
	include(INCLUDE_PATH.DS."fdbg.php");
	include(INCLUDE_PATH.DS."utils.php");
	include(INCLUDE_PATH.DS."session.php");
	include(INCLUDE_PATH.DS.'db/mySQLProvider.php');

	include(SERVICES_PATH.'APIInterface.php');
	include(SERVICES_PATH.'MidjourneyAPI.php');
	include(SERVICES_PATH.'BaseKlingApi.php');
	include(SERVICES_PATH.'KlingApi.php');

	define("AUTOLOAD_PATHS", [INCLUDE_PATH, CLASSES_PATH, MODELS_PATH]);
	spl_autoload_register(function ($class_name) {

		foreach (AUTOLOAD_PATHS as $path) {
			$pathFile = $path.DS.$class_name.".php";
			if (file_exists($pathFile)) {
			    	include_once($pathFile);
			    	return true;
			}
		}

		//throw new Exception("Can't load class {$class_name}", 1);
	});

	function exception_handler(Throwable $exception) {
		$error_msg = $exception->getFile().' '.$exception->getLine().': '.$exception->getMessage();
		echo $error_msg;
		trace_error($error_msg);
	}

	set_exception_handler('exception_handler');

	session_set_cookie_params([
	    'lifetime' => 86400, // 24 часа
	    'path' => '/',
	    'domain' => $_SERVER['HTTP_HOST'] ?? '',
	    'secure' => isset($_SERVER['HTTPS']), // только если HTTPS
	    'httponly' => true,
	    'samesite' => 'None' // КРИТИЧНО для работы в iframe!
	]);

	// Альтернативно через ini_set
	ini_set('session.cookie_samesite', 'None');
	ini_set('session.cookie_secure', isset($_SERVER['HTTPS']) ? '1' : '0');
	ini_set('session.cookie_httponly', '1');
?>