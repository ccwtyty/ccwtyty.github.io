(() => {
  const allowedHosts = new Set(["localhost", "127.0.0.1"]);
  const minHeight = 420;
  const maxHeight = 1400;
  const loadTimeoutMs = 15000;

  function setStatus(section, state, message) {
    const demo = section.querySelector(".private-demo");
    const status = section.querySelector(".private-demo-status");
    const button = section.querySelector(".private-demo-load");

    demo.dataset.demoState = state;
    status.textContent = message;

    if (state === "ready") {
      button.hidden = true;
      return;
    }

    button.hidden = false;
    button.disabled = state === "loading" || state === "unavailable";
    if (state === "error") button.textContent = "Retry interactive demo";
  }

  function initializeSection(section) {
    const project = section.dataset.privateDemo;
    const demo = section.querySelector(".private-demo");
    const button = section.querySelector(".private-demo-load");
    const frameWrap = section.querySelector(".private-demo-frame-wrap");
    const frame = section.querySelector(".private-demo-frame");
    let timeoutId;

    if (!allowedHosts.has(window.location.hostname)) {
      setStatus(
        section,
        "unavailable",
        "Private interactive preview unavailable on the public portfolio."
      );
      return;
    }

    function fail(message) {
      window.clearTimeout(timeoutId);
      setStatus(section, "error", message);
    }

    function loadDemo() {
      window.clearTimeout(timeoutId);
      button.textContent = "Loading interactive demo…";
      frameWrap.hidden = false;
      frame.removeAttribute("src");
      frame.style.height = `${minHeight}px`;
      setStatus(section, "loading", "Loading private interactive preview…");

      frame.src = `/__private_demos__/index.html?project=${encodeURIComponent(project)}&presentation=embedded`;
      timeoutId = window.setTimeout(() => {
        fail("The private preview did not respond. Start the local preview server with the demo build mounted, then retry.");
      }, loadTimeoutMs);
    }

    button.addEventListener("click", loadDemo);

    window.addEventListener("message", (event) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.contentWindow ||
        event.data?.type !== "portfolio:embed-status"
      ) {
        return;
      }

      const { ready, error, height } = event.data;
      if (typeof height === "number" && Number.isFinite(height)) {
        frame.style.height = `${Math.max(minHeight, Math.min(maxHeight, Math.ceil(height)))}px`;
      }

      if (error) {
        fail(`The private preview could not load: ${String(error)}`);
        return;
      }

      if (ready) {
        window.clearTimeout(timeoutId);
        setStatus(section, "ready", "Interactive preview loaded. Use the controls inside the demo.");
      }
    });

    demo.dataset.demoState = "idle";
  }

  document.querySelectorAll("[data-private-demo]").forEach(initializeSection);
})();
