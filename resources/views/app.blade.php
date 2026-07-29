<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="{{ config('status.description') }}">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title inertia>{{ config('status.name') }}</title>

        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">

        <link rel="preload" href="/fonts/sora-400.woff2" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="/fonts/sora-500.woff2" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="/fonts/sora-600.woff2" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="/fonts/sora-700.woff2" as="font" type="font/woff2" crossorigin>

        {{-- Applies the stored theme before first paint to avoid a flash. --}}
        <script src="/theme-bootstrap.js"></script>

        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="bg-zinc-100 font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        @inertia
    </body>
</html>
