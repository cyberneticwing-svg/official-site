(() => {
  async function loadSite() {
    try {
      const res = await fetch("/api/site");
      if (!res.ok) return;
      const data = await res.json();
      applyContact(data.contact || {});
      applySocial(data.social || {});
      applyTeam(data.team || []);
      applyClientsVisibility(data.settings);
      applyClients(data.clients || [], data.settings);
      applyServices(data.services || []);
      applyHomeServices(data.services || []);
      applyFooterServices(data.services || []);
    } catch {
      // Static fallback content remains visible if API is offline
    }
  }

  function applyClientsVisibility(settings) {
    const show = !settings || settings.showClients !== false;
    document.querySelectorAll("#our-clients, [data-clients-nav]").forEach((el) => {
      el.hidden = !show;
      el.style.display = show ? "" : "none";
    });
  }

  function applyClients(clients, settings) {
    if (settings && settings.showClients === false) return;
    document.querySelectorAll("#clients-grid").forEach((grid) => {
      if (!clients.length) return;
      grid.innerHTML = clients
        .map((c) => {
          const logo = c.logo
            ? `<div class="client-logo"><img src="${esc(c.logo)}" alt="${esc(c.name)}" /></div>`
            : `<div class="client-logo client-logo-fallback">${esc(initials(c.name))}</div>`;
          const link = c.website
            ? `<a class="client-link" href="${esc(c.website)}" target="_blank" rel="noopener">Visit website</a>`
            : "";
          return `
            <article class="client-card">
              ${logo}
              <h3>${esc(c.name)}</h3>
              <p class="client-industry">${esc(c.industry || "")}</p>
              <p>${esc(c.description || "")}</p>
              ${link}
            </article>`;
        })
        .join("");
    });
  }

  function applyContact(c) {
    document.querySelectorAll("[data-contact]").forEach((el) => {
      const key = el.getAttribute("data-contact");
      const value = c[key];
      if (value === undefined || value === null || value === "") return;

      if (el.tagName === "A") {
        if (key === "email") el.href = `mailto:${value}`;
        if (key === "phone") el.href = `tel:${String(value).replace(/\s+/g, "")}`;
        el.textContent = value;
      } else {
        el.textContent = value;
      }
    });
  }

  function applySocial(s) {
    const map = {
      instagram: s.instagram,
      facebook: s.facebook,
      linkedin: s.linkedin,
      youtube: s.youtube,
    };

    document.querySelectorAll("[data-social]").forEach((el) => {
      const key = el.getAttribute("data-social");
      const url = map[key];
      if (!url) {
        el.style.display = "none";
        return;
      }
      el.style.display = "";
      el.href = url;
      if (key === "instagram" && el.hasAttribute("data-social-label")) {
        const handle = url.replace(/\/$/, "").split("/").pop();
        el.textContent = `@${handle}`;
      }
    });
  }

  function applyTeam(team) {
    const grid = document.getElementById("team-grid");
    if (!grid || !team.length) return;

    const sorted = [...team].sort((a, b) => Number(b.isLead) - Number(a.isLead));
    grid.innerHTML = sorted
      .map((m) => {
        const leadClass = m.isLead ? " team-card-lead" : "";
        const photo = m.photo
          ? `<div class="team-photo"><img src="${esc(m.photo)}" alt="${esc(m.name)}" /></div>`
          : `<div class="team-photo team-photo-alt"><span>${esc(initials(m.name))}</span></div>`;
        return `
          <article class="team-card${leadClass} reveal visible">
            ${photo}
            <div class="team-info">
              <h3>${esc(m.name)}</h3>
              <p class="team-role">${esc(m.role || "")}</p>
              <p>${esc(m.bio || "")}</p>
            </div>
          </article>`;
      })
      .join("");
  }

  function applyServices(services) {
    const mount = document.getElementById("services-dynamic");
    if (!mount || !services.length) return;

    mount.innerHTML = services
      .map((s) => {
        const features = (s.features || []).map((f) => `<li>${esc(f)}</li>`).join("");
        const benefits = (s.benefits || []).map((b) => `<li>${esc(b)}</li>`).join("");
        const ideal = s.idealFor
          ? `<p class="ideal"><strong>Ideal for</strong> ${esc(s.idealFor)}</p>`
          : "";
        return `
          <section class="service-detail" id="${esc(s.id)}">
            <div class="container service-detail-grid reveal visible">
              <div>
                <p class="eyebrow">${esc(s.title)}</p>
                <h2>${esc(s.subtitle || s.title)}</h2>
                <p class="intro-text">${esc(s.description || "")}</p>
                ${features ? `<h3>Includes:</h3><ul class="feature-list">${features}</ul>` : ""}
                <a class="btn btn-primary" href="contact.html">${esc(s.cta || "Enquire Now")}</a>
              </div>
              <aside class="service-aside">
                <h3>Benefits</h3>
                <ul class="benefit-list">${benefits}</ul>
                ${ideal}
              </aside>
            </div>
          </section>`;
      })
      .join("");
  }

  function applyHomeServices(services) {
    const grid = document.getElementById("home-services-grid");
    if (!grid || !services.length) return;

    grid.innerHTML = services
      .map(
        (s, i) => `
      <article class="service-item reveal visible">
        <p class="service-num">${String(i + 1).padStart(2, "0")}</p>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.description || "")}</p>
      </article>`
      )
      .join("");
  }

  function applyFooterServices(services) {
    document.querySelectorAll("[data-footer-services]").forEach((ul) => {
      if (!services.length) return;
      ul.innerHTML = services
        .map((s) => `<li><a href="services.html#${esc(s.id)}">${esc(s.title)}</a></li>`)
        .join("");
    });
  }

  function initials(name) {
    return String(name || "?")
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  loadSite();
})();
