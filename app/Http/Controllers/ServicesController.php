<?php

namespace App\Http\Controllers;

use App\Services\DashboardDataService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ServicesController extends Controller
{
    public function __construct(private readonly DashboardDataService $data) {}

    public function index(Request $request): Response
    {
        return Inertia::render('services', $this->data->publicPage($request, '/services'));
    }
}
