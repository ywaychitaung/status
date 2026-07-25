try {
  const stored = localStorage.getItem("theme");
  const shouldUseDark = stored ? stored === "dark" : false;
  document.documentElement.classList.toggle("dark", shouldUseDark);
} catch {
  // Ignore theme initialization errors.
}

function setTheme(nextIsDark) {
  document.documentElement.classList.toggle("dark", nextIsDark);
  try {
    localStorage.setItem("theme", nextIsDark ? "dark" : "light");
  } catch {
    // Ignore storage failures.
  }
}

function toggleTheme() {
  setTheme(!document.documentElement.classList.contains("dark"));
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest("[data-theme-toggle]")) return;
  event.preventDefault();
  toggleTheme();
});

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.repeat) return;
  if (event.key.toLowerCase() !== "d") return;

  const active = document.activeElement;
  const activeTag = active && active.tagName;
  if (
    activeTag === "INPUT" ||
    activeTag === "TEXTAREA" ||
    (active && active.getAttribute("contenteditable") === "true")
  ) {
    return;
  }

  toggleTheme();
});
