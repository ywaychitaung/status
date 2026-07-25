try {
  const stored = localStorage.getItem("theme");
  const shouldUseDark = stored ? stored === "dark" : true;
  document.documentElement.classList.toggle("dark", shouldUseDark);
} catch {
  // Ignore theme initialization errors.
}
