<?php
declare(strict_types=1);

/*
 * CakePHP entry point
 */

require dirname(__DIR__) . '/config/paths.php';
require ROOT . DS . 'vendor' . DS . 'autoload.php';

use App\Application;
use Cake\Http\Server;

// Bind your application to the server.
$server = new Server(new Application(CONFIG));

// Run the request and emit the response.
$server->emit($server->run());
