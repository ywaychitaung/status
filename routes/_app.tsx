import { define } from "../utils.ts";
import { getAppName } from "@/lib/appConfig.ts";

export default define.page(function App({ Component }) {
  const appName = getAppName();
  return (
    <html class="bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{appName}</title>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script src="/theme-bootstrap.js"></script>
      </head>
      <body class="bg-zinc-100 font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        <Component />
      </body>
    </html>
  );
});
