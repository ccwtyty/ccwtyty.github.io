(() => {
  const page = document.querySelector(".case-study-page");
  if (!page) return;

  const main = page.querySelector("main");
  const title = main.querySelector("h1");
  const nav = document.createElement("nav");
  nav.className = "case-index";
  nav.setAttribute("aria-label", "Case study contents");

  const home = document.createElement("a");
  home.className = "case-index-home";
  home.href = "index.html";
  home.textContent = page.querySelector(".nav-name").textContent;
  nav.append(home);

  const back = document.createElement("a");
  back.className = "case-index-back";
  back.href = page.dataset.workArchive || "index.html#work";
  back.textContent = page.dataset.workArchive ? "Previous work" : "All work";
  nav.append(back);

  const label = document.createElement("p");
  label.className = "case-index-label";
  label.textContent = "On this page";
  nav.append(label);

  const links = document.createElement("ul");
  links.className = "case-index-links";
  nav.append(links);
  const sections = [];

  function addLink(target, text, id) {
    if (!target.id) target.id = id;
    target.tabIndex = -1;
    target.classList.add("case-anchor");
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${target.id}`;
    link.textContent = text;
    item.append(link);
    links.append(item);
    sections.push({ target, link });
  }

  addLink(title, "Overview", "case-overview");
  main.querySelectorAll(".cs-main > .cs-section").forEach((section, index) => {
    const heading = section.querySelector("h2");
    const copy = heading.cloneNode(true);
    copy.querySelectorAll(".emoji").forEach((emoji) => emoji.remove());
    const kicker = section.querySelector(".private-demo-kicker");
    const text = `${kicker ? `${kicker.textContent.trim()}: ` : ""}${copy.textContent.trim()}`;
    addLink(heading, text, `case-section-${index + 1}`);
  });
  addLink(main.querySelector(".cs-sidebar"), "Project details", "case-details");

  page.insertBefore(nav, main);
  page.classList.add("has-case-index");

  let currentSection;
  let scrollFrame = 0;

  function updateCurrentSection() {
    scrollFrame = 0;
    const readingLine = Math.min(160, window.innerHeight * 0.25);
    let current = sections[0];
    for (const section of sections) {
      if (section.target.getBoundingClientRect().top <= readingLine) current = section;
    }
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      current = sections[sections.length - 1];
    }
    if (current === currentSection) return;

    currentSection?.link.removeAttribute("aria-current");
    current.link.setAttribute("aria-current", "location");
    currentSection = current;

    // Scroll only the contents rail, never the article or the reader's focus.
    if (window.matchMedia("(min-width: 801px)").matches) {
      const rail = nav.getBoundingClientRect();
      const item = current.link.getBoundingClientRect();
      if (item.top < rail.top + 8) {
        nav.scrollTop += item.top - rail.top - 8;
      } else if (item.bottom > rail.bottom - 8) {
        nav.scrollTop += item.bottom - rail.bottom + 8;
      }
    }
  }

  function scheduleScrollUpdate() {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateCurrentSection);
  }

  window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
  window.addEventListener("resize", scheduleScrollUpdate);
  // Images and the private player can change section positions without scrolling.
  const layoutObserver = new ResizeObserver(scheduleScrollUpdate);
  layoutObserver.observe(main);

  // Generated fragment targets must also work when opening a deep link directly.
  const initialTarget = [...links.querySelectorAll("a")]
    .find((link) => link.hash === location.hash);
  if (initialTarget) {
    const target = document.getElementById(initialTarget.hash.slice(1));
    target.scrollIntoView({ behavior: "instant" });
    target.focus({ preventScroll: true });
  }
  updateCurrentSection();
})();
