<?php

namespace Tests\Unit;

use App\Support\MonitorUrl;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class MonitorUrlTest extends TestCase
{
    #[DataProvider('urls')]
    public function test_it_normalizes_urls(string $input, string $expected): void
    {
        $this->assertSame($expected, MonitorUrl::normalize($input));
    }

    /** @return array<string, array{string, string}> */
    public static function urls(): array
    {
        return [
            'adds https' => ['example.com', 'https://example.com'],
            'keeps http' => ['http://example.com', 'http://example.com'],
            'trims whitespace' => ['  example.com  ', 'https://example.com'],
            'lowercases host' => ['https://Example.COM', 'https://example.com'],
            'drops root path' => ['https://example.com/', 'https://example.com'],
            'drops trailing slash' => ['https://example.com/a/b/', 'https://example.com/a/b'],
            'drops fragment' => ['https://example.com/a#top', 'https://example.com/a'],
            'keeps query' => ['https://example.com/a?x=1', 'https://example.com/a?x=1'],
            'drops default https port' => ['https://example.com:443/a', 'https://example.com/a'],
            'drops default http port' => ['http://example.com:80/a', 'http://example.com/a'],
            'keeps custom port' => ['https://example.com:8443/a', 'https://example.com:8443/a'],
        ];
    }

    #[DataProvider('invalidUrls')]
    public function test_it_rejects_invalid_urls(string $input): void
    {
        $this->expectException(InvalidArgumentException::class);

        MonitorUrl::normalize($input);
    }

    /** @return array<string, array{string}> */
    public static function invalidUrls(): array
    {
        return [
            'empty' => [''],
            'whitespace only' => ['   '],
            'no host' => ['https://'],
        ];
    }

    public function test_it_detects_http_urls(): void
    {
        $this->assertTrue(MonitorUrl::isHttpUrl('http://example.com'));
        $this->assertTrue(MonitorUrl::isHttpUrl('HTTPS://example.com'));
        $this->assertFalse(MonitorUrl::isHttpUrl('example.com'));
        $this->assertFalse(MonitorUrl::isHttpUrl('aes256gcm$aa$bb'));
    }
}
