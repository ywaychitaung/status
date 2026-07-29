<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Domain error whose message is safe to show to the user, mirroring the
 * `throw new Error("...")` messages the legacy Deno app surfaced in the UI.
 */
class StatusException extends RuntimeException {}
