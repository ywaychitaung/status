<?php

namespace App\Http\Controllers;

use App\Services\DashboardDataService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class IncidentsController extends Controller
{
    public function __construct(private readonly DashboardDataService $data) {}

    public function index(Request $request): Response
    {
        return Inertia::render('incidents', $this->data->publicPage($request, '/incidents'));
    }
}
