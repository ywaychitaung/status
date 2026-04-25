import { define } from "../utils.ts";
import { getAppName } from "@/lib/appConfig.ts";

export default define.page(function App({ Component }) {
  const appName = getAppName();
  return (
    <html class="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{appName}</title>
        <script>
          {`try {
  const stored = localStorage.getItem("theme");
  const shouldUseDark = stored ? stored === "dark" : true;
  document.documentElement.classList.toggle("dark", shouldUseDark);
} catch {
  // Ignore theme initialization errors.
}`}
        </script>
      </head>
      <body class="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Component />
      </body>
    </html>
  );
});
